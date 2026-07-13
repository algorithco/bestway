import { setRequestLocale } from "next-intl/server";
import { ArticlesView } from "@/components/articles/articles-view";

export default async function ArticlesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ArticlesView />;
}
