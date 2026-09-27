import { defineRouting } from "next-intl/routing";

export const locales = ["uz", "en"] as const;
export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
  uz: "O'zbekcha",
  en: "English",
};

export const routing = defineRouting({
  locales,
  defaultLocale: "uz",
  // O'zbekcha uchun prefiks yo'q (/dashboard), inglizchada /en prefiksi bor.
  localePrefix: "as-needed",
});
