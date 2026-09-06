"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import { Check, Copy, Loader2, MonitorSmartphone } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Card } from "@/components/ui/card";
import { SpecularButton } from "@/components/ui/specular-button";
import { Field, Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api-client";

/** Desktop ilova tanigan yagona qaytish manzili (backend ham shuni talab qiladi) */
const DESKTOP_CALLBACK = "bestway-exam://auth/callback";

type Phase =
  | { name: "invalid" }
  | { name: "ready" }
  | { name: "authorizing" }
  | { name: "done"; code: string; callbackUrl: string }
  | { name: "error"; message: string }
  | { name: "needLogin" };

interface AuthorizeResponse {
  code: string;
  state: string;
  expiresAt: string;
}

export function DesktopAuthorize() {
  const t = useTranslations("desktopAuth");
  const tc = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const params = useSearchParams();
  const [phase, setPhase] = React.useState<Phase>({ name: "ready" });
  const [copied, setCopied] = React.useState(false);

  const device = params.get("device") ?? "";
  const state = params.get("state") ?? "";
  const codeChallenge = params.get("code_challenge") ?? "";
  const redirect = params.get("redirect") ?? "";
  const paramsValid =
    device.length >= 8 && state.length >= 16 && /^[A-Za-z0-9_-]{43}$/.test(codeChallenge);

  React.useEffect(() => {
    if (!paramsValid || redirect !== DESKTOP_CALLBACK) {
      setPhase({ name: "invalid" });
    }
  }, [paramsValid, redirect]);

  const loginNext = React.useMemo(() => {
    const search = params.toString();
    const full = search ? `${pathname}?${search}` : pathname;
    return encodeURIComponent(full);
  }, [pathname, params]);

  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;

  async function authorize() {
    setPhase({ name: "authorizing" });
    setCopied(false);
    try {
      const data = await api.post<AuthorizeResponse>("/auth/desktop/authorize", {
        deviceId: device,
        state,
        codeChallenge,
        redirect,
      });
      const callbackUrl = `${DESKTOP_CALLBACK}?code=${encodeURIComponent(data.code)}&state=${encodeURIComponent(data.state)}`;
      setPhase({ name: "done", code: data.code, callbackUrl });
      // Deep-link ilovani ochishga harakat qiladi; ishlamasa — qo'lda kod.
      window.location.assign(callbackUrl);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.code === "SESSION_EXPIRED")) {
        setPhase({ name: "needLogin" });
        return;
      }
      setPhase({
        name: "error",
        message: err instanceof ApiError ? err.message : tc("unknownError"),
      });
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card className="elevated-lg border-border/70 bg-surface/95 p-6 backdrop-blur-sm sm:p-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <MonitorSmartphone className="size-6" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-fg">{t("title")}</h1>
        <p className="mt-1.5 text-sm text-fg-muted">{t("subtitle")}</p>
      </div>

      {phase.name === "invalid" && (
        <p role="alert" className="rounded-[8px] border border-danger-border bg-danger-bg px-3 py-2.5 text-sm text-danger">
          {t("invalidParams")}
        </p>
      )}

      {phase.name === "needLogin" && (
        <div className="space-y-4 text-center">
          <p className="text-sm text-fg-muted">{t("needLogin")}</p>
          <Link
            href={`/login?next=${loginNext}`}
            className="inline-flex w-full items-center justify-center rounded-[12px] bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
          >
            {t("loginButton")}
          </Link>
        </div>
      )}

      {phase.name === "ready" && (
        <div className="space-y-4">
          <p className="text-sm text-fg-muted">{t("consent", { device: device.slice(0, 8) })}</p>
          <SpecularButton
            type="button"
            size="lg"
            radius={12}
            tint="#128139"
            tintOpacity={1}
            textColor="#ffffff"
            lineColor="#ffffff"
            baseColor="#0d6a2d"
            intensity={1.15}
            shineSize={10}
            shineFade={40}
            thickness={1.5}
            onClick={authorize}
            className="w-full"
          >
            {t("authorizeButton")}
          </SpecularButton>
        </div>
      )}

      {phase.name === "authorizing" && (
        <p className="flex items-center justify-center gap-2 text-sm text-fg-muted" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t("authorizing")}
        </p>
      )}

      {phase.name === "error" && (
        <div className="space-y-4">
          <p role="alert" className="rounded-[8px] border border-danger-border bg-danger-bg px-3 py-2.5 text-sm text-danger">
            {phase.message}
          </p>
          <button
            type="button"
            onClick={() => setPhase({ name: "ready" })}
            className="w-full rounded-[12px] border border-border px-4 py-2.5 text-sm font-medium text-fg hover:bg-surface"
          >
            {t("retryButton")}
          </button>
        </div>
      )}

      {phase.name === "done" && (
        <div className="space-y-4">
          <p className="text-center text-sm font-medium text-emerald-600">{t("successTitle")}</p>
          <p className="text-center text-xs text-fg-muted">{t("successHint")}</p>
          <Field label={t("codeLabel")} htmlFor="desktop-code">
            <div className="flex gap-2">
              <Input id="desktop-code" readOnly value={phase.code} className="font-mono" onFocus={(e) => e.target.select()} />
              <button
                type="button"
                onClick={() => copyCode(phase.code)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-[8px] border border-border px-3 text-sm text-fg hover:bg-surface"
              >
                {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                {copied ? t("copied") : t("copyButton")}
              </button>
            </div>
          </Field>
          <a
            href={phase.callbackUrl}
            className="inline-flex w-full items-center justify-center rounded-[12px] bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
          >
            {t("openAppButton")}
          </a>
          <p className="text-center text-[11px] text-fg-subtle">
            <Link href={`${prefix}/dashboard`} className="hover:underline">
              {t("backToDashboard")}
            </Link>
          </p>
        </div>
      )}
    </Card>
  );
}
