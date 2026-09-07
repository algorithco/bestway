import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  BandTables,
  DEFAULT_BAND_TABLES,
  parseBandTable,
} from '../mock/mock-scoring';

export const SETTING_KEYS = {
  /** O'qituvchi bir amalda o'zgartira oladigan maksimal ball (±) */
  teacherPointLimit: 'teacherPointLimit',
  /** Yangi o'quvchiga avtomatik beriladigan boshlang'ich ball */
  initialPoints: 'initialPoints',
  /** Standart oylik to'lov summasi (so'm) — to'lov jadvalida avtomatik to'ldiriladi */
  monthlyFee: 'monthlyFee',
  /** Oylik o'yinga qo'shilish uchun kerakli chegara ball (shu ballga yetgan o'yinga tushadi) */
  gameThreshold: 'gameThreshold',
  /** IELTS Listening xom→band jadvali [[minRaw, band], ...] — super_admin tahrirlaydi */
  ieltsBandListening: 'ieltsBandListening',
  /** IELTS Reading Academic xom→band jadvali */
  ieltsBandReadingAcademic: 'ieltsBandReadingAcademic',
  /** IELTS Reading General Training xom→band jadvali */
  ieltsBandReadingGeneral: 'ieltsBandReadingGeneral',
} as const;

export const SETTING_DEFAULTS: Record<string, number> = {
  [SETTING_KEYS.teacherPointLimit]: 20,
  [SETTING_KEYS.initialPoints]: 100,
  [SETTING_KEYS.monthlyFee]: 0,
  [SETTING_KEYS.gameThreshold]: 150,
};

/** `GET /settings` da qaytadigan sonli kalitlar (band jadvallari alohida endpointda). */
const NUMERIC_SETTING_KEYS: ReadonlyArray<string> = [
  SETTING_KEYS.teacherPointLimit,
  SETTING_KEYS.initialPoints,
  SETTING_KEYS.monthlyFee,
  SETTING_KEYS.gameThreshold,
];

@Injectable()
export class SettingsService {
  private cache = new Map<string, number>();
  private jsonCache = new Map<string, unknown>();

  constructor(private readonly prisma: PrismaService) {}

  async getNumber(key: string): Promise<number> {
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;
    const row = await this.prisma.setting.findUnique({ where: { key } });
    const value = row ? Number(row.value) : (SETTING_DEFAULTS[key] ?? 0);
    this.cache.set(key, value);
    return value;
  }

  async setNumber(key: string, value: number): Promise<void> {
    await this.prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    this.cache.set(key, value);
  }

  async all(): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const key of NUMERIC_SETTING_KEYS) {
      out[key] = await this.getNumber(key);
    }
    return out;
  }

  /** JSON sozlama (band jadvallari kabi) — yozuv bo'lmasa fallback qaytadi. */
  async getJson<T>(key: string, fallback: T): Promise<T> {
    const cached = this.jsonCache.get(key);
    if (cached !== undefined) return structuredClone(cached) as T;
    const row = await this.prisma.setting.findUnique({ where: { key } });
    if (!row || row.value === null || row.value === undefined) {
      return structuredClone(fallback);
    }
    this.jsonCache.set(key, row.value);
    return structuredClone(row.value) as T;
  }

  async setJson(key: string, value: unknown): Promise<void> {
    const clone = structuredClone(value) as Prisma.InputJsonValue;
    await this.prisma.setting.upsert({
      where: { key },
      update: { value: clone },
      create: { key, value: clone },
    });
    this.jsonCache.set(key, clone);
  }

  async deleteKey(key: string): Promise<void> {
    await this.prisma.setting.deleteMany({ where: { key } });
    this.jsonCache.delete(key);
    this.cache.delete(key);
  }

  /**
   * IELTS xom→band jadvallari (admin tahrirlaydigan). DB da buzilgan yozuv
   * bo'lsa — o'sha jadval uchun standart fallback ishlatiladi (scoring
   * hech qachon crash bo'lmaydi).
   */
  async getBandTables(): Promise<BandTables> {
    const [listening, readingAcademic, readingGeneral] = await Promise.all([
      this.getJson(SETTING_KEYS.ieltsBandListening, DEFAULT_BAND_TABLES.listening),
      this.getJson(SETTING_KEYS.ieltsBandReadingAcademic, DEFAULT_BAND_TABLES.readingAcademic),
      this.getJson(SETTING_KEYS.ieltsBandReadingGeneral, DEFAULT_BAND_TABLES.readingGeneral),
    ]);
    const safe = (raw: unknown, fallback: BandTables[keyof BandTables]) => {
      try {
        return parseBandTable(raw);
      } catch {
        return [...fallback] as Array<[number, number]>;
      }
    };
    return {
      listening: safe(listening, DEFAULT_BAND_TABLES.listening),
      readingAcademic: safe(readingAcademic, DEFAULT_BAND_TABLES.readingAcademic),
      readingGeneral: safe(readingGeneral, DEFAULT_BAND_TABLES.readingGeneral),
    };
  }

  /** Qaysi jadvallar standartdan farqli (admin tahrirlagan) — UI belgisi uchun. */
  async bandTablesCustomized(): Promise<Record<keyof BandTables, boolean>> {
    const rows = await this.prisma.setting.findMany({
      where: {
        key: {
          in: [
            SETTING_KEYS.ieltsBandListening,
            SETTING_KEYS.ieltsBandReadingAcademic,
            SETTING_KEYS.ieltsBandReadingGeneral,
          ],
        },
      },
      select: { key: true },
    });
    const present = new Set(rows.map((r) => r.key));
    return {
      listening: present.has(SETTING_KEYS.ieltsBandListening),
      readingAcademic: present.has(SETTING_KEYS.ieltsBandReadingAcademic),
      readingGeneral: present.has(SETTING_KEYS.ieltsBandReadingGeneral),
    };
  }
}
