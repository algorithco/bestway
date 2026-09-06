import { MockExamType, MockSkill } from '@prisma/client';

/**
 * IELTS band va Multilevel (CEFR) baholash — sof funksiyalar (I/O yo'q).
 *
 * Spec v2026.1 §4 (Official Reference for Developers, 2026.1):
 * Listening + Reading (Academic/General) uchun rasmiy xom→band jadvali.
 * §4 da 0–5 oralig'i ko'rsatilmagan — qaror #1 bo'yicha to'ldirildi:
 * 4–5 → 3.0, 2–3 → 2.5, 0–1 → 2.0 (bo'sh urinish → 0).
 */

/** Kamayuvchi tartibda [xom_min (40 dan), band] */
type BandTable = ReadonlyArray<readonly [number, number]>;

/** Spec §4 — Listening (39–40:9.0 … 6–9:3.5) + qaror #1 tail. */
const LISTENING_TABLE: BandTable = [
  [39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [27, 6.5], [23, 6],
  [20, 5.5], [16, 5], [13, 4.5], [10, 4], [6, 3.5],
  [4, 3], [2, 2.5], [0, 2],
];

/** Spec §4 — Reading Academic (Listening bilan bir xil) + qaror #1 tail. */
const ACADEMIC_READING_TABLE: BandTable = [
  [39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [27, 6.5], [23, 6],
  [20, 5.5], [16, 5], [13, 4.5], [10, 4], [6, 3.5],
  [4, 3], [2, 2.5], [0, 2],
];

/** Spec §4 — Reading General (40:9.0 … 6–9:3.5 eslatma: jadval Academic dan farqli) + qaror #1 tail. */
const GENERAL_READING_TABLE: BandTable = [
  [39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [27, 6.5], [23, 6],
  [20, 5.5], [16, 5], [13, 4.5], [10, 4], [6, 3.5],
  [4, 3], [2, 2.5], [0, 2],
];

/** Listening/Reading uchun avtomatik band; writing/speaking qo'lda kiritiladi */
export const AUTO_SKILLS: ReadonlyArray<MockSkill> = ['listening', 'reading'];
export const MANUAL_SKILLS: ReadonlyArray<MockSkill> = ['writing', 'speaking'];

function tableFor(skill: MockSkill, examType: MockExamType): BandTable {
  if (skill === 'listening') return LISTENING_TABLE;
  // reading
  return examType === 'ielts_general' ? GENERAL_READING_TABLE : ACADEMIC_READING_TABLE;
}

/**
 * Xom ballni (score/max) 40 balllik ekvivalentga keltirib, IELTS band chiqaradi.
 * Full-test da max har doim 40 bo'lishi kerak (scale buzilmasligi uchun).
 * max=0 bo'lsa 0 qaytadi. Bo'sh (javobsiz) urinish → 0.
 */
export function bandFromRaw(
  skill: MockSkill,
  examType: MockExamType,
  score: number,
  max: number,
): number {
  if (max <= 0) return 0;
  if (score <= 0) return 0;
  const scaled = Math.round((Math.max(0, Math.min(score, max)) / max) * 40);
  const table = tableFor(skill, examType);
  for (const [minRaw, band] of table) {
    if (scaled >= minRaw) return band;
  }
  return 0;
}

/** Spec §5: 0.5 qadamga yaxlitlash (F<0.25→.0; 0.25≤F<0.75→.5; F≥0.75→keyingi .0). */
export function roundHalfBand(value: number): number {
  return Math.round(value * 2) / 2;
}

/**
 * Umumiy IELTS band — spec §5: (L+R+W+S)/4 o'rtacha, 0.5 ga yaxlitlangan.
 * full_test da bo'lim yetishmasa ham maxraj 4 (qat'iy); practice da mavjud bandlar o'rtachasi.
 * Bo'sh massiv → null.
 */
export function overallBand(bands: number[], opts: { fixedDivisor?: number } = {}): number | null {
  const valid = bands.filter((b) => typeof b === 'number' && !Number.isNaN(b));
  if (valid.length === 0) return null;
  const divisor = opts.fixedDivisor ?? valid.length;
  const avg = valid.reduce((s, b) => s + b, 0) / divisor;
  return roundHalfBand(avg);
}

/** CEFR chegaralari (foizda) — Multilevel uchun (mos, sozlanadigan standart) */
const CEFR_THRESHOLDS: ReadonlyArray<readonly [number, string]> = [
  [90, 'C1'],
  [75, 'B2'],
  [60, 'B1'],
  [45, 'A2'],
  [30, 'A1'],
];

/** Umumiy foiz → CEFR daraja (Multilevel) */
export function cefrFromPercent(percent: number): string {
  for (const [min, level] of CEFR_THRESHOLDS) {
    if (percent >= min) return level;
  }
  return 'Below A1';
}

/** IELTS band → taxminiy CEFR (sertifikatda ko'rsatish uchun) */
export function cefrFromBand(band: number): string {
  if (band >= 8) return 'C1';
  if (band >= 6.5) return 'B2';
  if (band >= 5) return 'B1';
  if (band >= 4) return 'A2';
  return 'A1';
}
