import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Providers } from "@/components/providers";
import { CENTER } from "@/lib/config";
import { routing } from "@/i18n/routing";
import "../globals.css";

// Inter — lotin (uz/en) va kirill (ru) uchun. globals.css uni --font-inter orqali oladi.
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

// Uch tilni build vaqtida oldindan render qilamiz (statik sahifalar uchun)
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing" });

  return {
    title: {
      default: `${CENTER.name} — ${CENTER.tagline}`,
      template: `%s · ${CENTER.name}`,
    },
    description: t("heroSubtitle"),
    applicationName: CENTER.name,
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Noma'lum til — 404 (middleware odatda bunga yo'l qo'ymaydi, lekin himoya sifatida)
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Statik render uchun tilni so'rov kontekstiga bog'laymiz
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    // suppressHydrationWarning — next-themes <html> ga class qo'shadi (server bilmaydi)
    <html lang={locale} className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col antialiased">
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
