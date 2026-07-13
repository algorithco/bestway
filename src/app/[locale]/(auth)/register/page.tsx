import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { RegisterForm } from "@/components/auth/register-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("registerTitle") };
}

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  return (
    <Card className="elevated-lg border-border/70 bg-surface/95 p-6 backdrop-blur-sm sm:p-8">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold tracking-tight text-fg">{t("registerTitle")}</h1>
        <p className="mt-1.5 text-sm text-fg-muted">{t("registerSubtitle")}</p>
      </div>
      <RegisterForm />
    </Card>
  );
}
