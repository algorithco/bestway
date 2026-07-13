import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const SETTING_KEYS = {
  /** O'qituvchi bir amalda o'zgartira oladigan maksimal ball (±) */
  teacherPointLimit: 'teacherPointLimit',
  /** Yangi o'quvchiga avtomatik beriladigan boshlang'ich ball */
  initialPoints: 'initialPoints',
  /** Standart oylik to'lov summasi (so'm) — to'lov jadvalida avtomatik to'ldiriladi */
  monthlyFee: 'monthlyFee',
  /** Oylik o'yinga qo'shilish uchun kerakli chegara ball (shu ballga yetgan o'yinga tushadi) */
  gameThreshold: 'gameThreshold',
} as const;

export const SETTING_DEFAULTS: Record<string, number> = {
  [SETTING_KEYS.teacherPointLimit]: 20,
  [SETTING_KEYS.initialPoints]: 100,
  [SETTING_KEYS.monthlyFee]: 0,
  [SETTING_KEYS.gameThreshold]: 150,
};

@Injectable()
export class SettingsService {
  private cache = new Map<string, number>();

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
    for (const key of Object.values(SETTING_KEYS)) {
      out[key] = await this.getNumber(key);
    }
    return out;
  }
}
