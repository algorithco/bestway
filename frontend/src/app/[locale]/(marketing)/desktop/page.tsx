import type { Metadata } from "next";
import { Info, Lock, MonitorDown, RefreshCw, Save } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DesktopDownload } from "@/components/marketing/desktop-download";
import { Reveal } from "@/components/marketing/reveal";
import { Card } from "@/components/ui/card";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing" });
  return { title: t("desktopApp") };
}

const FEATURES = [
  { key: "desktopF1", Icon: Lock },
  { key: "desktopF2", Icon: Save },
  { key: "desktopF3", Icon: RefreshCw },
] as const;

export default async function DesktopPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("marketing");

  return (
    <div className="relative overflow-x-clip">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 overflow-hidden">
        <div className="bg-grid absolute inset-0 h-[420px] opacity-40" />
        <div className="anim-float absolute -top-20 left-[8%] size-52 rounded-full bg-brand/10 blur-3xl sm:size-64" />
        <div className="anim-float-slow absolute top-10 right-[6%] hidden size-72 rounded-full bg-accent/10 blur-3xl sm:block" />
      </div>
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-3xl text-center">
        <Reveal>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-fg-muted">
          <MonitorDown className="size-3.5 text-brand" aria-hidden />
          {t("desktopBadge")}
        </span>
        </Reveal>
        <Reveal delay={90}>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-balance text-fg sm:text-4xl">
          {t("desktopTitle")}
        </h1>
        </Reveal>
        <Reveal delay={180}>
        <p className="mt-3 text-pretty text-fg-muted sm:text-lg">{t("desktopSubtitle")}</p>
        </Reveal>
      </div>

      <Reveal delay={240}>
      <DesktopDownload />
      </Reveal>

      <div className="mx-auto mt-14 max-w-6xl">
        <Reveal>
        <h2 className="text-center text-2xl font-bold tracking-tight text-balance text-fg sm:text-3xl">
          {t("desktopWhyTitle")}
        </h2>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {FEATURES.map(({ key, Icon }, i) => (
            <Reveal key={key} delay={i * 90} className="h-full">
            <Card className="lift group h-full p-5">
              <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-brand-subtle text-brand-subtle-fg transition-transform duration-300 group-hover:scale-110">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-3 font-semibold text-fg">{t(`${key}Title`)}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{t(`${key}Text`)}</p>
            </Card>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
        <Card className="mt-4 flex items-start gap-3 p-5">
          <Info className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold text-fg">{t("desktopReqTitle")}</p>
            <p className="mt-1 leading-relaxed text-fg-muted">{t("desktopReqText")}</p>
            <p className="mt-2 leading-relaxed text-fg-muted">{t("desktopSignHint")}</p>
          </div>
        </Card>
        </Reveal>
      </div>
    </div>
    </div>
  );
}
