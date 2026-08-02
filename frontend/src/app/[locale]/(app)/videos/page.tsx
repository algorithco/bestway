import { setRequestLocale } from "next-intl/server";
import { VideosView } from "@/components/videos/videos-view";

export default async function VideosPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <VideosView />;
}
