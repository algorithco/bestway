/**
 * Markaz brendi — bir joyda. Nomni yoki aloqa ma'lumotlarini o'zgartirish
 * uchun faqat shu faylni tahrirlang.
 */
export const CENTER = {
  name: "BEST WAY",
  shortName: "BESTWAY",
  tagline: "Ingliz tili va xalqaro imtihonlarga tayyorlov markazi",
  founder: "Aziz Akhtamov",
  established: 2007,
  phone: "+998 90 123 45 67",
  phone2: "+998 91 234 56 78",
  email: "info@bestway.uz",
  address: "Shofirkon tumani, Buxoro viloyati",
  mapUrl: "https://maps.app.goo.gl/LgHbm8EYxr7FHBCdA",
  telegram: "https://t.me/bestway",
  instagram: "https://instagram.com/bestway",
} as const;

/**
 * Backend manzili. Faqat SERVER tomonda ishlatiladi:
 * brauzer hech qachon backendga to'g'ridan-to'g'ri murojaat qilmaydi,
 * hamma so'rov Next.js proxy (/api/backend/...) orqali o'tadi —
 * shunda access token httpOnly cookie'da qolib, JS'ga ko'rinmaydi.
 */
export const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

/** Cookie nomlari */
export const COOKIE = {
  access: "bw_at",
  refresh: "bw_rt",
  role: "bw_role",
} as const;
