import { setRequestLocale } from "next-intl/server";
import { GalleryView } from "@/components/gallery/gallery-view";

export default async function GalleryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <GalleryView />;
}
