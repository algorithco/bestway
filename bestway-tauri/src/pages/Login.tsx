import { useEffect, useRef, useState } from "react";
import { clearSession, login, setSession } from "@/lib/api";
import {
  startBrowserLogin,
  listenDeepLink,
  parseAuthCallbackUrl,
  exchangeCode,
  readBrowserLoginState,
  type BrowserLoginState,
} from "@/lib/oauth";

type Props = {
  onLogin: (studentId: string) => void;
};

export default function Login({ onLogin }: Props) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"idle" | "browser" | "password" | "exchange">("idle");
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [pending, setPending] = useState<BrowserLoginState | null>(null);
  const pendingRef = useRef<BrowserLoginState | null>(null);

  useEffect(() => {
    pendingRef.current = pending ?? readBrowserLoginState();
  }, [pending]);

  // Auto-catch bestway-exam://auth/callback deep links while on this screen.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listenDeepLink((url) => void handleCallback(url, pendingRef.current))
      .then((u) => (unlisten = u))
      .catch(() => {});
    return () => unlisten?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCallback(url: string, s: BrowserLoginState | null) {
    const p = parseAuthCallbackUrl(url);
    if (p.error) {
      setError(p.error);
      setBusy("idle");
      return;
    }
    // v1-compat: web returned tokens directly.
    if (p.accessToken) {
      setSession(p.accessToken, p.refreshToken ?? null);
      onLogin("student");
      return;
    }
    if (!p.code) return;
    if (!s) {
      setError("Login session expired. Start browser login again.");
      return;
    }
    if (!p.state || p.state !== s.state) {
      setError("State mismatch — possible CSRF. Start again.");
      return;
    }
    setBusy("exchange");
    setError(null);
    try {
      const session = await exchangeCode(p.code, s.verifier, s.deviceId);
      const id = (session.user?.id as string | undefined) ?? "student";
      onLogin(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Code exchange failed. Backend needs POST /auth/desktop/exchange.");
      setBusy("idle");
    }
  }

  async function handleBrowser() {
    setBusy("browser");
    setError(null);
    try {
      const s = await startBrowserLogin();
      setPending(s);
      setBusy("idle");
    } catch {
      setError("Could not open browser. Copy the login link manually.");
      setBusy("idle");
    }
  }

  async function handleManualCode(e: React.FormEvent) {
    e.preventDefault();
    const s = pending ?? readBrowserLoginState();
    if (!manualCode.trim() || !s) {
      setError("Paste the code from the browser first.");
      return;
    }
    await handleCallback(`bestway-exam://auth/callback?code=${encodeURIComponent(manualCode.trim())}&state=${s.state}`, s);
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
          {busy === "browser" ? "Opening browser…" : "Continue in web browser"}
        </button>
        <p className="mt-2 text-center text-[11px] leading-relaxed text-white/40">
          Browser opens the secure login page, then returns here automatically.
        </p>

        {pending && (
          <form onSubmit={handleManualCode} className="mt-4 rounded-xl border border-white/10 bg-black/40 p-3">
            <p className="text-[11px] text-white/50">
              Browser didn&apos;t return? Paste the code shown on the web page:
            </p>
            <div className="mt-2 flex gap-2">
              <input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="paste code"
                autoComplete="off"
                className="field min-w-0 flex-1 rounded-lg px-3 py-2 font-mono text-sm"
              />
              <button type="submit" className="btn-ghost rounded-lg px-3 py-2 text-sm text-white">
                Verify
              </button>
            </div>
          </form>
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
