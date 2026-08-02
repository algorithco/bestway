import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 300000 -> "300 000" (so'm summalari uchun) */
export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 })
    .format(amount)
    .replace(/ /g, " ");
}

/** Date | "2026-07-10" -> "2026-07-10" (UTC bo'yicha, mahalliy vaqtga surilmaydi) */
export function toDateKey(date: Date | string): string {
  if (typeof date === "string") return date.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

/** "2026-07" — joriy oy kaliti */
export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-07" -> { year: 2026, month: 7 } */
export function parseMonthKey(key: string): { year: number; month: number } {
  const [year, month] = key.split("-").map(Number);
  return { year, month };
}

/** Oydagi kunlar soni */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Ismdan bosh harflar: "Otabek Valiyev" -> "OV" */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Telefonni ko'rsatish uchun: +998901234567 -> +998 90 123 45 67 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 12) return phone;
  return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`;
}
