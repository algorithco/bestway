import { setRequestLocale } from "next-intl/server";

/**
 * Chromeless group for full-screen experiences (demo exam runner).
 * No SiteHeader / SiteFooter — the page provides its own chrome.
 */
export default async function FullscreenLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <div className="min-h-dvh overflow-x-clip">{children}</div>;
}
