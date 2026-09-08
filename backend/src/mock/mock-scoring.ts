import { MockExamType, MockSkill } from '@prisma/client';

/**
 * IELTS band va Multilevel (CEFR) baholash — sof funksiyalar (I/O yo'q).
 *
 * Listening/Reading (Academic/General) uchun xom→band jadvallari quyida
 * standart (default) qiymatlar sifatida saqlanadi. Real IELTS har bir test
 * formasi uchun jadvalni biroz siljitadi (equating), shuning uchun adminlar
 * ularni `Setting` (`ieltsBandListening`, `ieltsBandReadingAcademic`,
 * `ieltsBandReadingGeneral`) orqali tahrirlashi mumkin — `parseBandTable`
 * + `SettingsService.getBandTables` ga qarang. Bu fayldagi jadvallar faqat
 * fallback (DB da yozuv bo'lmasa) sifatida ishlatiladi.
 */

/** Kamayuvchi tartibda [xom_min (40 dan), band] */
export type BandRow = readonly [number, number];
export type BandTable = ReadonlyArray<BandRow>;

export interface BandTables {
  listening: BandTable;
  readingAcademic: BandTable;
  readingGeneral: BandTable;
}

/**
 * Listening (raw /40 → band): 39–40=9, 37–38=8.5, 35–36=8, 32–34=7.5,
 * 30–31=7, 26–29=6.5, 23–25=6, 18–22=5.5, 16–17=5, 13–15=4.5, 11–12=4,
 * pastdagilar — quyi bandlar.
 */
export const DEFAULT_LISTENING_TABLE: BandTable = [
  [39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6],
  [18, 5.5], [16, 5], [13, 4.5], [11, 4], [6, 3.5],
  [4, 3], [2, 2.5], [0, 2],
];

/**
 * Reading Academic (raw /40 → band): 39–40=9, 37–38=8.5, 35–36=8,
 * 33–34=7.5, 30–32=7, 27–29=6.5, 23–26=6, 19–22=5.5, 15–18=5,
 * 13–14=4.5, 10–12=4, pastdagilar — quyi bandlar.
 */
export const DEFAULT_ACADEMIC_READING_TABLE: BandTable = [
  [39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6],
  [19, 5.5], [15, 5], [13, 4.5], [10, 4], [6, 3.5],
  [4, 3], [2, 2.5], [0, 2],
];

/**
 * Reading General Training (raw /40 → band): 40=9, 39=8.5, 37–38=8,
 * 36=7.5, 34–35=7, 32–33=6.5, 30–31=6, 27–29=5.5, 23–26=5, 19–22=4.5,
 * 15–18=4, pastdagilar — quyi bandlar.
 */
export const DEFAULT_GENERAL_READING_TABLE: BandTable = [
  [40, 9], [39, 8.5], [37, 8], [36, 7.5], [34, 7], [32, 6.5], [30, 6],
  [27, 5.5], [23, 5], [19, 4.5], [15, 4], [12, 3.5],
  [9, 3], [6, 2.5], [3, 2], [0, 2],
];

export const DEFAULT_BAND_TABLES: BandTables = {
  listening: DEFAULT_LISTENING_TABLE,
  readingAcademic: DEFAULT_ACADEMIC_READING_TABLE,
  readingGeneral: DEFAULT_GENERAL_READING_TABLE,
};

/** Listening/Reading uchun avtomatik band; writing/speaking qo'lda kiritiladi */
export const AUTO_SKILLS: ReadonlyArray<MockSkill> = ['listening', 'reading'];
export const MANUAL_SKILLS: ReadonlyArray<MockSkill> = ['writing', 'speaking'];

/** Writing mezonlari: Task Achievement/Response, Coherence & Cohesion, Lexical Resource, Grammar */
export const WRITING_RUBRICS: ReadonlyArray<string> = ['ta', 'cc', 'lr', 'gra'];
/** Speaking mezonlari: Fluency & Coherence, Lexical Resource, Grammar, Pronunciation */
export const SPEAKING_RUBRICS: ReadonlyArray<string> = ['fluency', 'lexical', 'grammar', 'pronunciation'];

/** Bo'lim bo'yicha ruxsat etilgan rubric kalitlari */
export function rubricKeysFor(skill: MockSkill): ReadonlyArray<string> {
  return skill === 'writing' ? WRITING_RUBRICS : SPEAKING_RUBRICS;
}

/**
 * Admin kiritgan jadvalni tekshirib, normallashtiradi (kamayuvchi tartib,
 * takroriy minRaw — eng kattasi olinadi). Xato bo'lsa `Error` otadi.
 * Format: [[minRaw 0..40 (int), band 0..9 (0.5 qadam)], ...], eng oxirgi
 * qator minRaw=0 bo'lishi shart (0–40 to'liq qoplansin).
 */
export function parseBandTable(input: unknown): Array<[number, number]> {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error('Band jadvali bo‘sh bo‘lmasligi kerak');
  }
  const rows: Array<[number, number]> = input.map((row) => {
    if (!Array.isArray(row) || row.length !== 2) {
      throw new Error('Har bir qator [minRaw, band] ko‘rinishida bo‘lsin');
    }
    const [minRaw, band] = row;
    if (!Number.isInteger(minRaw) || minRaw < 0 || minRaw > 40) {
      throw new Error(`minRaw 0 dan 40 gacha butun son bo‘lsin (keldi: ${minRaw})`);
    }
    if (typeof band !== 'number' || Number.isNaN(band) || band < 0 || band > 9) {
      throw new Error(`band 0 dan 9 gacha bo‘lsin (keldi: ${band})`);
    }
    if (Math.round(band * 2) !== band * 2) {
      throw new Error(`band 0.5 qadamda bo‘lsin (keldi: ${band})`);
    }
    return [minRaw, band];
  });
  rows.sort((a, b) => b[0] - a[0]);
  const deduped: Array<[number, number]> = [];
  for (const row of rows) {
    if (deduped.length > 0 && deduped[deduped.length - 1][0] === row[0]) continue;
    deduped.push(row);
  }
  if (deduped[deduped.length - 1][0] !== 0) {
    throw new Error('Jadvalning oxirgi qatori minRaw=0 bo‘lishi shart');
  }
  return deduped;
}

function tableFor(skill: MockSkill, examType: MockExamType, tables: BandTables): BandTable {
  if (skill === 'listening') return tables.listening;
  // reading
  return examType === 'ielts_general' ? tables.readingGeneral : tables.readingAcademic;
}

/**
 * Xom ballni (score/max) 40 balllik ekvivalentga keltirib, IELTS band chiqaradi.
 * Full-test da max har doim 40 bo'lishi kerak (scale buzilmasligi uchun).
 * max=0 bo'lsa 0 qaytadi.
 * `attempted=false` (birorta ham javob berilmagan) → 0 — "urinilmagan" holat.
 * `attempted=true` (default) bo'lsa jadval har doim qo'llanadi, jumladan
 * 0 xom ball jadvalning nol-qatoriga tushadi (standart jadvallarda band 2) —
 * "urindi, lekin 0 topladi" holati "urinmadi" holatidan shu bilan farqlanadi.
 * `tables` berilmasa standart jadval ishlatiladi (admin `Setting` orqali
 * o'zgartirgan bo'lsa, grading service DB dagi jadvalni uzatadi).
 */
export function bandFromRaw(
  skill: MockSkill,
  examType: MockExamType,
  score: number,
  max: number,
  tables: BandTables = DEFAULT_BAND_TABLES,
  attempted = true,
): number {
  if (max <= 0) return 0;
  if (!attempted) return 0;
  const scaled = Math.round((Math.max(0, Math.min(score, max)) / max) * 40);
  const table = tableFor(skill, examType, tables);
  for (const [minRaw, band] of table) {
    if (scaled >= minRaw) return band;
  }
  return 0;
}

/**
 * Rasmiy IELTS yaxlitlash: o'rtacha 0.5 ga eng yaqin qiymatga yaxlitlanadi.
 * `.25 keyingi .5 ga ko'tariladi, `.75 keyingi butunga ko'tariladi:
 * 6.0 → 6.0; 6.25 → 6.5; 6.625 → 6.5; 6.75 → 7.0.
 */
export function roundHalfBand(value: number): number {
  return Math.round(value * 2) / 2;
}

/**
 * Mezon ballari o'rtachasi → band (Writing/Speaking rubric avg).
 * Bo'sh massiv → null.
 */
export function criteriaAverage(scores: number[]): number | null {
  const valid = scores.filter((s) => typeof s === 'number' && !Number.isNaN(s));
  if (valid.length === 0) return null;
  return roundHalfBand(valid.reduce((sum, s) => sum + s, 0) / valid.length);
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
