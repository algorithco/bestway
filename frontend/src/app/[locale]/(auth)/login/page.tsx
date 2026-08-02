import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/feedback";
import { LoginForm } from "@/components/auth/login-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("loginTitle") };
}

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  return (
    <Card className="elevated-lg border-border/70 bg-surface/95 p-6 backdrop-blur-sm sm:p-8">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold tracking-tight text-fg">{t("loginTitle")}</h1>
        <p className="mt-1.5 text-sm text-fg-muted">{t("loginSubtitle")}</p>
      </div>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <LoginForm />
      </Suspense>
    </Card>
  );
}
