/**
 * Davomat sanasi bazada "faqat sana" (@db.Date) sifatida, ya'ni UTC yarim tunda saqlanadi
 * (`new Date('2026-07-10')` → 2026-07-10T00:00:00Z).
 *
 * Shu sababli solishtirishda ham UTC yarim tunni qurish kerak:
 * mahalliy `setHours(0,0,0,0)` boshqa qiymat beradi (Toshkentda 5 soat farq) va
 * so'rov hech narsa topmaydi.
 */

/** Bugungi mahalliy kalendar sanasi, UTC yarim tunda */
export function todayDateOnly(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/** Joriy (yoki berilgan) oyning boshi va keyingi oy boshi — UTC yarim tunda */
export function monthRangeUtc(year?: number, month?: number): { gte: Date; lt: Date } {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth() + 1;
  return { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
}
