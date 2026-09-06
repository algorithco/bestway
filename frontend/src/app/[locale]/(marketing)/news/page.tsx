import type { Metadata } from "next";
import { ArrowLeft, Newspaper } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { getArticles } from "@/lib/public-api";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing" });
  return { title: t("newsTitle") };
}

export default async function NewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("marketing");
  const tCommon = await getTranslations("common");
  const format = await getFormatter();
  const articles = await getArticles(24);

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <Link href="/#news" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 mb-6")}>
        <ArrowLeft />
        {tCommon("back")}
      </Link>
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-balance text-fg sm:text-4xl">
          {t("newsTitle")}
        </h1>
        <p className="mt-3 text-pretty text-fg-muted">{t("newsSubtitle")}</p>
      </div>

      {articles.length === 0 ? (
        <div className="mt-12">
          <EmptyState icon={Newspaper} title={t("newsSubtitle")} />
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <Link key={a.id} href={`/news/${a.id}`} className="group">
              <Card className="h-full p-6 transition-colors group-hover:border-border-strong">
                {a.category && (
                  <span className="text-xs font-semibold tracking-wide text-brand uppercase">
                    {a.category}
                  </span>
                )}
                <h2 className="mt-2 line-clamp-2 text-lg font-semibold text-fg">{a.title}</h2>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-fg-muted">{a.body}</p>
                <time className="mt-4 block text-xs text-fg-subtle">
                  {format.dateTime(new Date(a.createdAt), {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </time>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
