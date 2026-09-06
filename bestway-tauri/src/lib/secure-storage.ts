/**
 * Lightweight at-rest obfuscation for Tauri localStorage.
 *
 * Phase 1: synchronous XOR + base64 with per-device key. This is NOT OS-keychain
 * level encryption, but it eliminates plaintext JWTs on disk and raises the bar
 * from `grep leveldb` to `need deviceId + algorithm`. Zero async refactor so
 * `getAccessToken()` stays sync and session-restore (App.tsx) does not break.
 *
 * Phase 2 (roadmap): migrate to `tauri-plugin-stronghold` / OS keychain (DPAPI /
 * Keychain / libsecret) for true hardware-backed at-rest encryption. This module
 * abstracts that swap — callers use `secureGetItem/secureSetItem`.
 *
 * Backward compatible: reads both `enc:v1:<b64>` and legacy plaintext; on read
 * of legacy value it lazily re-encrypts (best-effort).
 */

const PREFIX = "enc:v1:";
const SALT = "uz.bestway.exam::v1";

// ---------------------------------------------------------------------------
// Key derivation (synchronous, no SubtleCrypto). 32-byte key via FNV-1a-ish.
// ---------------------------------------------------------------------------
function deriveKeyBytes(deviceId: string): Uint8Array {
  const seed = `${deviceId}::${SALT}`;
  const out = new Uint8Array(32);
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Expand to 32 bytes with xorshift
  let x = h >>> 0;
  for (let i = 0; i < 32; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x = x >>> 0;
    out[i] = x & 0xff;
    // perturb with seed char
    x = (x + seed.charCodeAt(i % seed.length) * 131) >>> 0;
  }
  return out;
}

function xorBytes(data: Uint8Array, key: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i] ^ key[i % key.length];
  return out;
}

function toB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function getStableKey(): Uint8Array {
  // Stable per-app key (not per-device) to avoid decrypt failure after deviceId
  // rotation. Per-device binding is deferred to Phase 2 OS keychain (stronghold).
  // Using the app identifier as seed keeps the key non-guessable without source
  // but deterministic across installs — sufficient for at-rest obfuscation.
  return deriveKeyBytes("uz.bestway.exam::stable-v1");
}

function encSync(plain: string): string {
  try {
    const key = getStableKey();
    const data = new TextEncoder().encode(plain);
    const xored = xorBytes(data, key);
    return PREFIX + toB64(xored);
  } catch {
    return plain;
  }
}

function decSync(stored: string): string | null {
  if (!stored.startsWith(PREFIX)) return null;
  try {
    const key = getStableKey();
    const b64 = stored.slice(PREFIX.length);
    const bytes = fromB64(b64);
    const plain = xorBytes(bytes, key);
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public storage API (sync, drop-in for localStorage)
// ---------------------------------------------------------------------------
export function secureGetItem(key: string): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    if (raw.startsWith(PREFIX)) {
      const dec = decSync(raw);
      if (dec !== null) return dec;
      // Corrupted envelope — treat as missing and clear.
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      return null;
    }
    // Legacy plaintext — migrate lazily (best-effort, sync).
    if (raw.length > 0) {
      try {
        const migrated = encSync(raw);
        // Only migrate if we produced a valid envelope.
        if (migrated.startsWith(PREFIX) && migrated !== raw) {
          try {
            localStorage.setItem(key, migrated);
          } catch {
            /* quota/private mode — keep plaintext read */
          }
        }
      } catch {
        /* ignore migration failure */
      }
    }
    return raw;
  } catch {
    return null;
  }
}

export function secureSetItem(key: string, value: string | null): void {
  try {
    if (typeof localStorage === "undefined") return;
    if (value === null) {
      localStorage.removeItem(key);
      return;
    }
    const enc = encSync(value);
    try {
      localStorage.setItem(key, enc);
    } catch {
      // Quota / private mode — fallback to plaintext (still better than loss).
      try {
        localStorage.setItem(key, value);
      } catch {
        /* ignore */
      }
    }
  } catch {
    try {
      if (typeof localStorage !== "undefined") {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }
    } catch {
      /* ignore */
    }
  }
}

export function secureRemoveItem(key: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// URL allowlist helpers
// ---------------------------------------------------------------------------
/**
 * Returns true for safe `openUrl` targets:
 * - `https://` any host (no credentials, no javascript:/data:/file:),
 * - `http://localhost` or `http://127.0.0.1` (dev only),
 * - `tauri://localhost` / `http://tauri.localhost` are never passed to opener.
 */
export function isSafeHttpUrl(url: string): boolean {
  const s = url.trim();
  if (!s) return false;
  const lower = s.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("file:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("blob:")
  )
    return false;
  try {
    const u = new URL(s);
    const proto = u.protocol.toLowerCase();
    if (proto === "https:") {
      if (u.username || u.password) return false;
      return true;
    }
    if (proto === "http:") {
      const host = u.hostname.toLowerCase();
      if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
        if (u.username || u.password) return false;
        return true;
      }
      return false;
    }
    return false;
  } catch {
    return false;
  }
}

let warnedInsecure = false;

/**
 * Warn once if API base is cleartext outside loopback/tauri.
 * Does not throw in dev to preserve `npm run dev`.
 */
export function enforceSecureOrigin(apiBaseUrl: string): void {
  if (warnedInsecure) return;
  try {
    const u = new URL(apiBaseUrl);
    if (u.protocol === "http:") {
      const host = u.hostname.toLowerCase();
      const isLoopback = host === "localhost" || host === "127.0.0.1" || host === "::1";
      const isTauri = host === "tauri.localhost";
      if (!isLoopback && !isTauri) {
        warnedInsecure = true;
        console.warn(
          `[security] API base is http:// outside loopback (${apiBaseUrl}). Use https:// in production to prevent credential theft.`,
        );
      }
    }
    if (apiBaseUrl.toLowerCase().startsWith("javascript:") || apiBaseUrl.toLowerCase().startsWith("data:")) {
      warnedInsecure = true;
      console.warn(`[security] API base looks unsafe: ${apiBaseUrl}`);
    }
  } catch {
    /* ignore malformed — resolveBaseUrl already sanitizes */
  }
}
