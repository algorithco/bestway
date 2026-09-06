import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Skeleton } from "@/components/ui/feedback";
import { DesktopAuthorize } from "@/components/auth/desktop-authorize";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "desktopAuth" });
  return { title: t("title") };
}

export default async function DesktopOAuthPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <DesktopAuthorize />
    </Suspense>
  );
}

export const dynamic = "force-dynamic";
