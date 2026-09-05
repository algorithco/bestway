/**
 * Browser-based login for the Tauri desktop app.
 *
 * Flow (standard Tauri OAuth pattern, no secrets in the client):
 * 1. Desktop creates state + PKCE verifier, opens SYSTEM BROWSER to
 *    `${WEB_URL}/oauth/desktop?device=...&state=...&redirect=bestway-exam://auth/callback`
 * 2. Student logs in on the web (phone+password, existing backend).
 * 3. Web backend redirects to `bestway-exam://auth/callback?code=...&state=...`
 *    (or directly with accessToken+refreshToken for v1 compat).
 * 4. Desktop catches the deep link, exchanges `code` at
 *    `POST /auth/desktop/exchange`, stores session.
 *
 * Backend TODO (2 endpoints, see README):
 * - GET  /oauth/desktop (web page, login, then redirect to `redirect` param)
 * - POST /auth/desktop/exchange { code, verifier, deviceId }
 */

import { post, setSession } from "./api";
import { ensureDeviceId } from "./session";

export const DESKTOP_SCHEME = "bestway-exam";
export const DESKTOP_CALLBACK = `${DESKTOP_SCHEME}://auth/callback`;

function webBaseUrl(): string {
  const fromEnv =
    typeof import.meta !== "undefined"
      ? ((import.meta.env?.VITE_WEB_URL as string | undefined) ??
        (import.meta.env?.VITE_API_URL as string | undefined))
      : undefined;
  // VITE_API_URL points at .../v1 — strip it to guess the web origin.
  const raw = (fromEnv ?? "http://localhost:3000").trim().replace(/\/+$/, "");
  return raw.replace(/\/v1$/, "");
}

function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface BrowserLoginState {
  state: string;
  verifier: string;
  deviceId: string;
}

export function newBrowserLoginState(): BrowserLoginState {
  const s: BrowserLoginState = {
    state: randomToken(16),
    verifier: randomToken(32),
    deviceId: ensureDeviceId(),
  };
  try {
    sessionStorage.setItem("bestway.oauth", JSON.stringify(s));
  } catch {
    /* private mode — caller keeps `s` in memory */
  }
  return s;
}

export function readBrowserLoginState(): BrowserLoginState | null {
  try {
    const raw = sessionStorage.getItem("bestway.oauth");
    return raw ? (JSON.parse(raw) as BrowserLoginState) : null;
  } catch {
    return null;
  }
}

export function buildAuthorizeUrl(s: BrowserLoginState): string {
  const q = new URLSearchParams({
    device: s.deviceId,
    state: s.state,
    redirect: DESKTOP_CALLBACK,
  });
  return `${webBaseUrl()}/oauth/desktop?${q.toString()}`;
}

/** Open the system browser (Tauri opener) with web fallback. */
export async function openInBrowser(url: string): Promise<void> {
  try {
    const mod = await import("@tauri-apps/plugin-opener");
    await mod.openUrl(url);
    return;
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export async function startBrowserLogin(): Promise<BrowserLoginState> {
  const s = newBrowserLoginState();
  await openInBrowser(buildAuthorizeUrl(s));
  return s;
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

/** Parse `bestway-exam://auth/callback?...` into params. Pure — unit-testable. */
export function parseAuthCallbackUrl(url: string): {
  code?: string;
  state?: string;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
} {
  try {
    // Custom schemes parse via URL when // present.
    const u = new URL(url);
    const q = u.searchParams;
    // Also support hash fragment form (#accessToken=...).
    const hash = new URLSearchParams(u.hash.replace(/^#/, ""));
    const pick = (k: string) => q.get(k) ?? hash.get(k) ?? undefined;
    return {
      code: pick("code"),
      state: pick("state"),
      accessToken: pick("accessToken"),
      refreshToken: pick("refreshToken"),
      error: pick("error"),
    };
  } catch {
    return {};
  }
}

export type DeepLinkUnlisten = () => void;

/**
 * Listen for the OS deep-link callback. Resolves once with the callback URL.
 * No-op (never resolves) outside Tauri — caller should also offer manual paste.
 */
export async function waitForDeepLink(timeoutMs = 120_000): Promise<string> {
  const mod = await import("@tauri-apps/plugin-deep-link");
  return new Promise<string>((resolve, reject) => {
    let done = false;
    const timer = window.setTimeout(() => {
      if (!done) {
        done = true;
        reject(new Error("Timed out waiting for browser login. Paste the code manually."));
      }
    }, timeoutMs);

    void mod.onOpenUrl((urls) => {
      if (done) return;
      const hit = urls.find((u) => u.startsWith(`${DESKTOP_SCHEME}:`));
      if (hit) {
        done = true;
        window.clearTimeout(timer);
        resolve(hit);
      }
    });
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
