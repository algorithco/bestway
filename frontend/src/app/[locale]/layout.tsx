import type { Metadata } from "next";
import Script from "next/script";
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
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
  preload: true,
  fallback: ["system-ui", "sans-serif"],
  adjustFontFallback: true,
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
    <html lang={locale} data-scroll-behavior="smooth" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* FOUC oldini olish: sahifa ko'rinmasdan oldin tema class'ini o'rnatamiz. 
            next/script beforeInteractive — React 19 da <script> ni komponent ichida render qilish warningini oldini oladi. */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('theme')||'system',m=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light',r=s==='system'?m:s,d=document.documentElement;d.classList.remove('light','dark');r&&d.classList.add(r);d.style.colorScheme=r}catch(e){}})();`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col antialiased">
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
