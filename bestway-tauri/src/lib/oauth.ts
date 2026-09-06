/**
 * Browser-based login for the Tauri desktop app (PKCE-S256).
 *
 * Flow:
 * 1. Desktop creates state + PKCE verifier, opens SYSTEM BROWSER to
 *    `${WEB_URL}/oauth/desktop?device=...&state=...&code_challenge=...&code_challenge_method=S256&redirect=bestway-exam://auth/callback`
 * 2. Student logs in on the web (phone+password, existing backend session).
 * 3. Student approves -> web calls `POST /auth/desktop/authorize`, then
 *    redirects to `bestway-exam://auth/callback?code=...&state=...`
 *    (or shows the code for manual paste when the deep link misses).
 * 4. Desktop catches the deep link (or pasted URL), verifies `state`,
 *    exchanges `code` at `POST /auth/desktop/exchange`, stores session.
 *
 * Security properties:
 * - `verifier` never leaves the desktop except inside the exchange POST body.
 * - `state` is mandatory on every callback path (CSRF protection).
 * - No tokens ever travel in URLs (code-only exchange).
 */

import { post, setSession } from "./api";
import { ensureDeviceId } from "./session";

export const DESKTOP_SCHEME = "bestway-exam";
export const DESKTOP_CALLBACK = `${DESKTOP_SCHEME}://auth/callback`;

/** Web origin — NEVER derived from the API URL (api.* vs app.* differ in prod). */
function webBaseUrl(): string {
  const fromEnv =
    typeof import.meta !== "undefined"
      ? ((import.meta.env?.BESTWAY_WEB_URL as string | undefined) ??
        (import.meta.env?.VITE_WEB_URL as string | undefined))
      : undefined;
  const raw = (fromEnv ?? "http://localhost:3000").trim().replace(/\/+$/, "");
  return raw;
}

function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

function base64Url(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** PKCE-S256 challenge: BASE64URL(SHA256(verifier ASCII)). */
export async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(digest);
}

export interface BrowserLoginState {
  state: string;
  verifier: string;
  deviceId: string;
  createdAt: number;
}

/** Login attempt lifetime — stale attempts are rejected (10 min). */
export const OAUTH_STATE_TTL_MS = 10 * 60_000;
const STORAGE_KEY = "bestway.oauth";

export function newBrowserLoginState(): BrowserLoginState {
  const s: BrowserLoginState = {
    state: randomToken(16),
    verifier: randomToken(32),
    deviceId: ensureDeviceId(),
    createdAt: Date.now(),
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* private mode — caller keeps `s` in memory */
  }
  return s;
}

export function readBrowserLoginState(): BrowserLoginState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as BrowserLoginState;
    if (!s?.state || !s?.verifier || !s?.deviceId) return null;
    if (typeof s.createdAt === "number" && Date.now() - s.createdAt > OAUTH_STATE_TTL_MS) {
      clearBrowserLoginState();
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function clearBrowserLoginState(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export async function buildAuthorizeUrl(s: BrowserLoginState): Promise<string> {
  const q = new URLSearchParams({
    device: s.deviceId,
    state: s.state,
    code_challenge: await codeChallenge(s.verifier),
    code_challenge_method: "S256",
    redirect: DESKTOP_CALLBACK,
  });
  return `${webBaseUrl()}/oauth/desktop?${q.toString()}`;
}

/**
 * Open the system browser (Tauri opener). Never falls back to `window.open`:
 * inside the kiosk webview that would trap the login page — instead the
 * caller shows the authorize URL for manual copy.
 */
export async function openInBrowser(url: string): Promise<void> {
  const mod = await import("@tauri-apps/plugin-opener");
  await mod.openUrl(url);
}

export interface StartedBrowserLogin {
  state: BrowserLoginState;
  authorizeUrl: string;
}

export async function startBrowserLogin(): Promise<StartedBrowserLogin> {
  const s = newBrowserLoginState();
  const authorizeUrl = await buildAuthorizeUrl(s);
  await openInBrowser(authorizeUrl);
  return { state: s, authorizeUrl };
}

export interface DesktopExchangeResponse {
  user: { id: string; [k: string]: unknown };
  accessToken: string;
  refreshToken: string;
}

export async function exchangeCode(code: string, verifier: string, deviceId: string) {
  const session = await post<DesktopExchangeResponse>(
    "/auth/desktop/exchange",
    { code, verifier, deviceId },
    { token: null },
  );
  if (session?.accessToken) setSession(session.accessToken, session.refreshToken ?? null);
  return session;
}

export interface AuthCallbackParams {
  code?: string;
  state?: string;
  error?: string;
}

/**
 * Parse `bestway-exam://auth/callback?...` into params. Pure — unit-testable.
 * Accepts query (`?...`) and hash (`#...` / `#?...`) forms, plus the opaque
 * `bestway-exam:auth/callback?...` shape some platforms deliver.
 */
export function parseAuthCallbackUrl(url: string): AuthCallbackParams {
  try {
    const normalized = url.replace(/^([a-z][a-z0-9+.-]*):(?!\/\/)/i, "$1://");
    const u = new URL(normalized);
    const q = u.searchParams;
    const hash = new URLSearchParams(u.hash.replace(/^#\??/, ""));
    const pick = (k: string) => q.get(k) ?? hash.get(k) ?? undefined;
    const out: AuthCallbackParams = {
      code: pick("code"),
      state: pick("state"),
      error: pick("error"),
    };
    if (!out.code && !out.error) return { error: "Unrecognized callback URL" };
    return out;
  } catch {
    return { error: "Unrecognized callback URL" };
  }
}

export type DeepLinkUnlisten = () => void;

/**
 * Cold-start links: URLs that launched the app (before any listener ran).
 * Returns them (empty when none / outside Tauri).
 */
export async function readInitialDeepLink(): Promise<string[]> {
  try {
    const mod = await import("@tauri-apps/plugin-deep-link");
    if (typeof mod.getCurrent !== "function") return [];
    const urls = await mod.getCurrent();
    return (urls ?? []).filter((u) => u.startsWith(`${DESKTOP_SCHEME}:`));
  } catch {
    return [];
  }
}

/**
 * Listen for the OS deep-link callback. Resolves once with the callback URL.
 * Unsubscribes on resolve AND on timeout (no listener leak).
 * Rejects on timeout — caller should offer manual paste of the FULL callback URL.
 */
export async function waitForDeepLink(timeoutMs = 120_000): Promise<string> {
  const mod = await import("@tauri-apps/plugin-deep-link");
  return new Promise<string>((resolve, reject) => {
    let done = false;
    let unlisten: (() => void) | undefined;
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      try {
        unlisten?.();
      } catch {
        /* ignore */
      }
      fn();
    };
    const timer = window.setTimeout(() => {
      finish(() => reject(new Error("Timed out waiting for browser login. Paste the full callback URL manually.")));
    }, timeoutMs);

    void Promise.resolve(mod.onOpenUrl((urls) => {
      const hit = urls.find((u) => u.startsWith(`${DESKTOP_SCHEME}:`));
      if (hit) finish(() => resolve(hit));
    })).then(
      (u) => {
        unlisten = typeof u === "function" ? u : undefined;
        if (done) {
          try {
            unlisten?.();
          } catch {
            /* ignore */
          }
        }
      },
      () => {
        finish(() => reject(new Error("Deep-link listener unavailable in this build.")));
      },
    );
  });
}

export function listenDeepLink(cb: (url: string) => void): Promise<DeepLinkUnlisten> {
  return import("@tauri-apps/plugin-deep-link").then((mod) =>
    mod.onOpenUrl((urls) => {
      const hit = urls.find((u) => u.startsWith(`${DESKTOP_SCHEME}:`));
      if (hit) cb(hit);
    }),
  );
}
