import { useEffect, useRef, useState } from "react";
import { clearSession, login } from "@/lib/api";
import {
  clearBrowserLoginState,
  listenDeepLink,
  parseAuthCallbackUrl,
  exchangeCode,
  readBrowserLoginState,
  readInitialDeepLink,
  startBrowserLogin,
  type BrowserLoginState,
} from "@/lib/oauth";

type Props = {
  onLogin: (studentId: string) => void;
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
      const role = String((session.user as { role?: unknown } | undefined)?.role ?? "");
      if (role && role !== "student") {
        clearSession();
        setError("This app is for students only.");
        setBusy("idle");
        return;
      }
      const id = (session.user?.id as string | undefined) ?? "student";
      onLoginRef.current(id);
    } catch (e) {
      setError(friendlyExchangeError(e));
      setBusy("idle");
    }
  }

  // Catch deep links: cold-start (app launched by URL) + live events.
  useEffect(() => {
    let dead = false;
    let unlisten: (() => void) | undefined;
    void readInitialDeepLink().then((urls) => {
      if (dead) return;
      const hit = urls[0];
      if (hit) void handleCallback(hit, pendingRef.current ?? readBrowserLoginState());
    });
    listenDeepLink((url) => void handleCallback(url, pendingRef.current ?? readBrowserLoginState()))
      .then((u) => {
        if (dead) u();
        else unlisten = u;
      })
      .catch(() => {
        if (!dead) setError("Deep-link plugin unavailable — use the manual paste below.");
      });
    return () => {
      dead = true;
      unlisten?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleBrowser() {
    setBusy("browser");
    setError(null);
    setAuthorizeUrl(null);
    try {
      const { state: s, authorizeUrl: url } = await startBrowserLogin();
      // Sync ref immediately — a fast deep link may arrive before re-render.
      pendingRef.current = s;
      setPending(s);
      setAuthorizeUrl(url);
      // busy stays "browser" until the callback (or cancel) resolves it.
    } catch {
      setError("Could not open the system browser. Copy the login link below manually.");
      setBusy("idle");
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
    if (!manualUrl.trim() || !s) {
      setError("Paste the full callback URL from the browser first.");
      return;
    }
    await handleCallback(manualUrl.trim(), s);
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy("password");
    setError(null);
    try {
      const session = await login(phone.trim(), password);
      const role = String(session.user?.role ?? "student");
      if (role !== "student") {
        clearSession();
        setError("This app is for students only.");
        setBusy("idle");
        return;
      }
      onLogin(session.user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Check phone/password.");
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
              <p className="mt-2 break-all text-[11px] text-white/40">
                Browser didn&apos;t open? Copy this link manually:{" "}
                <span className="font-mono text-emerald-300">{authorizeUrl}</span>
              </p>
            )}
            <form onSubmit={handleManualUrl} className="mt-3">
              <p className="text-[11px] text-white/50">
                App didn&apos;t continue? Paste the FULL callback URL from the web page:
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="bestway-exam://auth/callback?code=…&state=…"
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
            className="field w-full rounded-xl px-4 py-2.5 text-sm"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            autoComplete="current-password"
            className="field w-full rounded-xl px-4 py-2.5 text-sm"
          />
          <button
            type="submit"
            disabled={busy !== "idle"}
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
  const status =
    typeof e === "object" && e !== null
      ? ((e as { status?: unknown }).status as number | undefined)
      : undefined;
  if (status === 404 || code === "HTTP_404") {
    return "Backend is too old: needs POST /auth/desktop/exchange. Update the server or sign in with password.";
  }
  if (code === "DESKTOP_CODE_EXPIRED") return "Code expired (5 min). Start browser login again.";
  if (code === "DESKTOP_CODE_USED") return "Code already used. Start browser login again.";
  if (code === "DEVICE_MISMATCH") return "Code was created for another device. Start again on this device.";
  if (code === "INVALID_VERIFIER") return "Security check failed. Start browser login again.";
  if (code === "NOT_A_STUDENT") return "This app is for students only.";
  if (e instanceof Error && e.message) return e.message;
  return "Code exchange failed. Check connection and try again.";
}
