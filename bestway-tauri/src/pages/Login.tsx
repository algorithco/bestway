import { useEffect, useRef, useState } from "react";
import { clearSession, login } from "@/lib/api";
import {
  buildAuthorizeUrl,
  clearBrowserLoginState,
  listenDeepLink,
  listenSingleInstance,
  newBrowserLoginState,
  openInBrowser,
  parseAuthCallbackUrl,
  parseManualCallbackInput,
  exchangeCode,
  readBrowserLoginState,
  readInitialDeepLink,
  type BrowserLoginState,
} from "@/lib/oauth";

type Props = {
  onLogin: (student: { id: string; name: string | null }) => void;
};

type Busy = "idle" | "browser" | "password" | "exchange";

export default function Login({ onLogin }: Props) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<Busy>("idle");
  const [error, setError] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const [authorizeUrl, setAuthorizeUrl] = useState<string | null>(null);
  const [pending, setPending] = useState<BrowserLoginState | null>(null);

  const pendingRef = useRef<BrowserLoginState | null>(null);
  const onLoginRef = useRef(onLogin);
  useEffect(() => {
    onLoginRef.current = onLogin;
  }, [onLogin]);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  async function handleCallback(url: string, s: BrowserLoginState | null) {
    const p = parseAuthCallbackUrl(url);
    if (p.error && !p.code) {
      setError(p.error);
      setBusy("idle");
      return;
    }
    if (!s) {
      setError("Login session expired. Start browser login again.");
      setBusy("idle");
      return;
    }
    // CSRF check is mandatory on EVERY callback path — no exceptions.
    if (!p.state || p.state !== s.state) {
      setError("State mismatch — possible CSRF. Start again.");
      setBusy("idle");
      return;
    }
    if (p.error && !p.code) {
      setError(p.error);
      setBusy("idle");
      return;
    }
    if (!p.code) {
      setError(p.error ?? "No code in callback URL.");
      setBusy("idle");
      return;
    }
    setBusy("exchange");
    setError(null);
    try {
      const session = await exchangeCode(p.code, s.verifier, s.deviceId);
      clearBrowserLoginState();
      // Fail-closed role gate: missing role must NOT pass.
      const role = String((session.user as { role?: unknown } | undefined)?.role ?? "");
      if (role !== "student") {
        clearSession();
        setError("This app is for students only.");
        setBusy("idle");
        return;
      }
      const id = (session.user?.id as string | undefined) ?? null;
      if (!id) {
        clearSession();
        setError("Login failed: server returned no user id.");
        setBusy("idle");
        return;
      }
      const name =
        typeof (session.user as unknown as { name?: unknown })?.name === "string"
          ? ((session.user as unknown as { name: string }).name as string)
          : null;
      onLoginRef.current({ id, name });
    } catch (e) {
      setError(friendlyExchangeError(e));
      setBusy("idle");
    }
  }

  // Catch deep links: cold-start (app launched by URL) + live events
  // + Windows/Linux second-instance forwards (see src-tauri/src/main.rs).
  useEffect(() => {
    let dead = false;
    const unlistens: Array<() => void> = [];
    const seen = new Set<string>();
    const handleOnce = (url: string, s: BrowserLoginState | null) => {
      if (seen.has(url)) return;
      seen.add(url);
      void handleCallback(url, s);
    };
    void readInitialDeepLink().then((urls) => {
      if (dead) return;
      for (const hit of urls) handleOnce(hit, pendingRef.current ?? readBrowserLoginState());
    });
    const onUrl = (url: string) => handleOnce(url, pendingRef.current ?? readBrowserLoginState());
    listenDeepLink(onUrl)
      .then((u) => {
        if (dead) u();
        else unlistens.push(u);
      })
      .catch(() => {
        if (!dead) setError("Deep-link plugin unavailable — use the manual paste below.");
      });
    // Second-instance argv forwarded by Rust as `single-instance` event.
    listenSingleInstance(onUrl)
      .then((u) => {
        if (dead) u();
        else unlistens.push(u);
      })
      .catch(() => {
        /* event plugin always present in Tauri; ignore outside Tauri */
      });
    // Don't hang forever on "Waiting for browser login…" — hint at manual paste.
    const timer = window.setTimeout(() => {
      if (!dead) {
        // Only nudge; the listeners stay alive until Cancel.
        setError((prev) => prev ?? "Still waiting — if the browser didn't return, paste the callback URL or code below.");
      }
    }, 120_000);
    return () => {
      dead = true;
      window.clearTimeout(timer);
      for (const u of unlistens) {
        try {
          u();
        } catch {
          /* ignore */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleBrowser() {
    setBusy("browser");
    setError(null);
    setAuthorizeUrl(null);
    // Build state + URL FIRST so an opener failure never loses the link.
    // The old code threw the URL away inside startBrowserLogin() and fell
    // back to idle with "copy the link below" but no link shown.
    let s: BrowserLoginState;
    let url: string;
    try {
      s = newBrowserLoginState();
      url = await buildAuthorizeUrl(s);
    } catch {
      setError("Could not create the login link. Check connection and try again.");
      setBusy("idle");
      return;
    }
    // Sync ref immediately — a fast deep link may arrive before re-render.
    pendingRef.current = s;
    setPending(s);
    setAuthorizeUrl(url);
    // busy stays "browser" until the callback (or cancel) resolves it —
    // even when auto-open fails, so the copy/paste fallback stays visible.
    try {
      await openInBrowser(url);
    } catch {
      setError("Could not open the system browser automatically. Copy the login link below manually.");
    }
  }

  function cancelBrowser() {
    clearBrowserLoginState();
    pendingRef.current = null;
    setPending(null);
    setAuthorizeUrl(null);
    setManualUrl("");
    setError(null);
    setBusy("idle");
  }

  async function handleManualUrl(e: React.FormEvent) {
    e.preventDefault();
    const s = pendingRef.current ?? readBrowserLoginState();
    const raw = manualUrl.trim();
    if (!raw) {
      setError("Paste the full callback URL or code from the browser first.");
      return;
    }
    if (!s) {
      setError("Login session expired. Start browser login again.");
      return;
    }
    // Accept FULL callback URL (preferred) or RAW code (web "copy code" fallback).
    const parsed = parseManualCallbackInput(raw, s);
    if (parsed.error && !parsed.code) {
      setError(parsed.error);
      return;
    }
    const url =
      raw.includes("://") || raw.toLowerCase().startsWith("bestway-exam:")
        ? raw
        : `bestway-exam://auth/callback?code=${encodeURIComponent(parsed.code!)}&state=${encodeURIComponent(parsed.state!)}`;
    await handleCallback(url, s);
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    // Normalize like web (login-form.tsx): strip spaces so
    // "+998 90 123 45 67" matches stored "+998901234567".
    const normalizedPhone = phone.replace(/\s/g, "");
    if (!normalizedPhone || !password) {
      setError("Enter phone number and password.");
      return;
    }
    setBusy("password");
    setError(null);
    try {
      const session = await login(normalizedPhone, password);
      // Fail-closed: missing/unknown role must NOT default to student.
      const role = String(session.user?.role ?? "");
      if (role !== "student") {
        clearSession();
        setError("This app is for students only.");
        setBusy("idle");
        return;
      }
      if (!session.user?.id) {
        clearSession();
        setError("Login failed: server returned no user id.");
        setBusy("idle");
        return;
      }
      onLogin({ id: session.user.id, name: session.user.name ?? null });
    } catch (err) {
      const apiErr = err as { code?: string; message?: string } | null;
      const msg =
        typeof apiErr?.message === "string" && apiErr.message
          ? apiErr.code
            ? `${apiErr.message} (${apiErr.code})`
            : apiErr.message
          : err instanceof Error
            ? err.message
            : "Login failed. Check phone/password.";
      setError(msg);
      setBusy("idle");
    }
  }

  return (
    <section className="mx-auto w-full max-w-md">
      <div className="card rounded-2xl p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 font-bold text-black shadow-[0_0_28px_rgba(56,199,101,0.5)]">
            B
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Bestway Exam</h1>
            <p className="text-xs text-white/50">Student lockdown client · online-only</p>
          </div>
        </div>

        {busy === "browser" ? (
          <div className="mt-6 rounded-xl border border-white/10 bg-black/40 p-4">
            <p className="text-sm text-white/70">Waiting for browser login…</p>
            <p className="mt-1 text-[11px] leading-relaxed text-white/40">
              Approve the request in the opened browser tab, then return here. The app continues automatically.
            </p>
            {authorizeUrl && (
              <div className="mt-2">
                <p className="break-all text-[11px] text-white/40">
                  Browser didn&apos;t open? Copy this link manually:
                </p>
                <div className="mt-1 flex gap-2">
                  <input
                    readOnly
                    value={authorizeUrl}
                    onFocus={(e) => e.target.select()}
                    autoComplete="off"
                    spellCheck={false}
                    className="field min-w-0 flex-1 rounded-lg px-3 py-2 font-mono text-[11px] text-emerald-300"
                  />
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard?.writeText(authorizeUrl).catch(() => undefined)}
                    className="btn-ghost shrink-0 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    Copy
                  </button>
                </div>
                <a
                  href={authorizeUrl}
                  className="mt-1 inline-block text-[11px] text-emerald-300 underline"
                >
                  Open login link
                </a>
              </div>
            )}
            <form onSubmit={handleManualUrl} className="mt-3">
              <p className="text-[11px] text-white/50">
                App didn&apos;t continue? Paste the FULL callback URL — or just the code — from the web page:
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="bestway-exam://auth/callback?code=…&state=… or paste code"
                  autoComplete="off"
                  spellCheck={false}
                  className="field min-w-0 flex-1 rounded-lg px-3 py-2 font-mono text-xs"
                />
                <button type="submit" className="btn-ghost rounded-lg px-3 py-2 text-sm text-white">
                  Verify
                </button>
              </div>
            </form>
            <button
              type="button"
              onClick={cancelBrowser}
              className="btn-ghost mt-3 w-full rounded-lg px-3 py-2 text-sm text-white/70"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={handleBrowser}
              disabled={busy !== "idle"}
              className="btn-brand mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              Continue in web browser
            </button>
            <p className="mt-2 text-center text-[11px] leading-relaxed text-white/40">
              Browser opens the secure login page, then returns here automatically.
            </p>
          </>
        )}

        <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-widest text-white/30">
          <span className="h-px flex-1 bg-white/10" /> or with password <span className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={handlePassword} className="space-y-3">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+998 __ ___ __ __"
            inputMode="tel"
            autoComplete="tel"
            disabled={busy === "password" || busy === "exchange"}
            className="field w-full rounded-xl px-4 py-2.5 text-sm disabled:opacity-60"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            autoComplete="current-password"
            disabled={busy === "password" || busy === "exchange"}
            className="field w-full rounded-xl px-4 py-2.5 text-sm disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={busy === "password" || busy === "exchange"}
            className="btn-ghost w-full rounded-xl px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy === "password" || busy === "exchange" ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}
      </div>
      <p className="mt-3 text-center text-[11px] text-white/30">
        Locked exam mode starts after admin locks your session.
      </p>
    </section>
  );
}

function friendlyExchangeError(e: unknown): string {
  const code =
    typeof e === "object" && e !== null
      ? ((e as { code?: unknown }).code as string | undefined)
      : undefined;
  const message =
    typeof e === "object" && e !== null
      ? ((e as { message?: unknown }).message as string | undefined)
      : undefined;
  const status =
    typeof e === "object" && e !== null
      ? ((e as { status?: unknown }).status as number | undefined)
      : undefined;
  if (status === 404 || code === "HTTP_404") {
    return "Backend is too old: needs POST /auth/desktop/exchange. Update the server or sign in with password.";
  }
  if (code === "INVALID_DESKTOP_CODE") return "Invalid code. Start browser login again.";
  if (code === "INVALID_REDIRECT") return "App/Server redirect mismatch. Update both to bestway-exam://auth/callback.";
  if (code === "DESKTOP_CODE_EXPIRED") return "Code expired (5 min). Start browser login again.";
  if (code === "DESKTOP_CODE_USED") return "Code already used. Start browser login again.";
  if (code === "DEVICE_MISMATCH") return "Code was created for another device. Start again on this device.";
  if (code === "INVALID_VERIFIER") return "Security check failed. Start browser login again.";
  if (code === "NOT_A_STUDENT") return "This app is for students only.";
  if (code === "USER_DEACTIVATED") return "Account blocked. Contact administration.";
  if (typeof message === "string" && message && code) return `${message} (${code})`;
  if (e instanceof Error && e.message) return e.message;
  return "Code exchange failed. Check connection and try again.";
}
