import type { Metadata } from "next";
import { Clock, FileText, FlaskConical, Layers } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { buttonVariants } from "@/components/ui/button-variants";
import { getDemoTests } from "@/lib/public-api";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing" });
  return { title: t("demoTitle") };
}

export default async function DemoListingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tc, tCommon] = await Promise.all([
    getTranslations("marketing"),
    getTranslations("tests"),
    getTranslations("common"),
  ]);
  const tests = await getDemoTests();

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
      {/* Hero */}
      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-fg-muted">
          <FlaskConical className="size-3.5 text-brand" />
          {t("demoTitle")} · {tc("demo")}
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-balance text-fg sm:text-4xl">
          {t("demoHeroTitle")}
        </h1>
        <p className="mt-3 text-pretty text-fg-muted sm:text-lg">{t("demoHeroSubtitle")}</p>
        <p className="mt-2 text-xs text-fg-subtle">{t("demoTryHint")}</p>
      </div>

      {tests.length === 0 ? (
        <div className="mx-auto mt-12 max-w-xl">
          <EmptyState
            icon={FileText}
            title={t("demoEmpty")}
            description={t("demoEmptyHint")}
            action={
              <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "mt-2")}>
                {tCommon("back")}
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="mx-auto mt-6 flex max-w-3xl items-center justify-between gap-4 border-y border-border py-3 text-sm text-fg-muted">
            <span>
              {tests.length} demo {tests.length === 1 ? "test" : "tests"}
            </span>
            <span className="text-xs">{t("demoSubtitle")}</span>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {tests.map((test) => (
              <Link key={test.id} href={`/demo/${test.id}`} className="group block h-full">
                <Card className="flex h-full flex-col p-5 transition-colors group-hover:border-border-strong">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="brand" className="capitalize">
                      {test.type}
                    </Badge>
                    {test.isDemo && (
                      <Badge variant="success">{tc("demo")}</Badge>
                    )}
                    {test.level && (
                      <Badge variant="neutral">{test.level}</Badge>
                    )}
                  </div>

                  <h2 className="mt-3 line-clamp-2 text-lg font-semibold text-fg">{test.title}</h2>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-fg-muted">
                    <span className="inline-flex items-center gap-1">
                      <FileText className="size-3.5" />
                      {test.questionCount} {tc("questions")}
                    </span>
                    {test.durationMinutes ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5" />
                        {test.durationMinutes} {tc("minutes")}
                      </span>
                    ) : null}
                    {test.sections.length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Layers className="size-3.5" />
                        {test.sections.map((s) => tc(`sections.${s}`)).join(" · ")}
                      </span>
                    )}
                  </div>

                  {test.sections.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {test.sections.map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-bg-subtle px-2 py-0.5 text-xs font-medium text-fg-muted"
                        >
                          {tc(`sections.${s}`)}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto pt-5">
                    <span
                      className={cn(
                        buttonVariants({ size: "sm" }),
                        "w-full justify-center group-hover:bg-brand-hover",
                      )}
                    >
                      {t("demoStart")}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
