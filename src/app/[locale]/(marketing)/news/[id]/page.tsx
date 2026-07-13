import type { Metadata } from "next";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { notFound } from "next/navigation";
import { getFormatter, setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { getArticle } from "@/lib/public-api";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticle(id);
  return { title: article?.title ?? "" };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("marketing");
  const format = await getFormatter();
  const article = await getArticle(id);

  if (!article) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link
        href="/news"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="size-4" />
        {t("allNews")}
      </Link>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {article.category && <Badge variant="brand">{article.category}</Badge>}
        <span className="flex items-center gap-1.5 text-sm text-fg-subtle">
          <CalendarDays className="size-4" />
          {format.dateTime(new Date(article.createdAt), {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
      </div>

      <h1 className="mt-4 text-3xl font-bold tracking-tight text-balance text-fg sm:text-4xl">
        {article.title}
      </h1>

      {article.authorName && (
        <p className="mt-3 text-sm text-fg-muted">{article.authorName}</p>
      )}

      <div className="mt-8 leading-relaxed whitespace-pre-wrap text-fg">{article.body}</div>

      {article.tags.length > 0 && (
        <div className="mt-10 flex flex-wrap gap-2 border-t border-border pt-6">
          {article.tags.map((tag) => (
            <Badge key={tag} variant="neutral">
              #{tag}
            </Badge>
          ))}
        </div>
      )}
    </article>
  );
}
