import { defineRouting } from "next-intl/routing";

export const locales = ["uz", "ru", "en"] as const;
export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
  uz: "O'zbekcha",
  ru: "Русский",
  en: "English",
};

export const routing = defineRouting({
  locales,
  defaultLocale: "uz",
  // O'zbekcha uchun prefiks yo'q (/dashboard), qolganlarida bor (/ru/dashboard)
  localePrefix: "as-needed",
});
