import { MockExamType, MockSkill } from '@prisma/client';

/**
 * IELTS band va Multilevel (CEFR) baholash — sof funksiyalar (I/O yo'q).
 *
 * IELTS xom→band jadvallari (40 savolga nisbatan) — amaliyot mocklarida keng
 * qo'llaniladigan mos jadvallar. Rasmiy jadval test bo'yicha biroz farq qilishi
 * mumkin; kerak bo'lsa MockExam.bandScale bilan override qilinadi (kelajakda).
 */

/** Kamayuvchi tartibda [xom_min (40 dan), band] */
type BandTable = ReadonlyArray<readonly [number, number]>;

const LISTENING_TABLE: BandTable = [
  [39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6],
  [20, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5],
  [3, 2], [2, 1.5], [1, 1],
];

const ACADEMIC_READING_TABLE: BandTable = [
  [39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6],
  [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5],
  [3, 2], [2, 1.5], [1, 1],
];

const GENERAL_READING_TABLE: BandTable = [
  [40, 9], [39, 8.5], [37, 8], [36, 7.5], [34, 7], [32, 6.5], [30, 6],
  [27, 5.5], [23, 5], [19, 4.5], [15, 4], [12, 3.5], [9, 3], [6, 2.5],
  [4, 2], [2, 1.5], [1, 1],
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
 * max=0 bo'lsa 0 qaytadi.
 */
export function bandFromRaw(
  skill: MockSkill,
  examType: MockExamType,
  score: number,
  max: number,
): number {
  if (max <= 0) return 0;
  const scaled = Math.round((Math.max(0, Math.min(score, max)) / max) * 40);
  const table = tableFor(skill, examType);
  for (const [minRaw, band] of table) {
    if (scaled >= minRaw) return band;
  }
  return 0;
}

/** 0.5 qadamga yaxlitlash (IELTS qoidasi: .25 → .5, .75 → keyingi butun) */
export function roundHalfBand(value: number): number {
  return Math.round(value * 2) / 2;
}

/**
 * Umumiy IELTS band — 4 bo'lim bandlarining o'rtachasi, 0.5 ga yaxlitlangan.
 * Bo'sh massiv → null.
 */
export function overallBand(bands: number[]): number | null {
  const valid = bands.filter((b) => typeof b === 'number' && !Number.isNaN(b));
  if (valid.length === 0) return null;
  const avg = valid.reduce((s, b) => s + b, 0) / valid.length;
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
