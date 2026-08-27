import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/app.exception';
import { toCsv } from '../common/csv.util';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SETTING_KEYS, SettingsService } from '../settings/settings.service';

/**
 * Oylik o'yin tizimi.
 *
 * Asosiy g'oya: `StudentProfile.currentPoints` — bu FAQAT joriy oyning balli.
 * `pointsPeriod` ("YYYY-MM") qaysi oyga tegishli ekanini belgilaydi. Oy almashsa:
 *   1) o'tgan oy `MonthlyPointsArchive`ga yoziladi (kim necha ball, kim o'yinda edi),
 *   2) `currentPoints` boshlang'ich ballga (standart 100) qaytadi,
 *   3) `gameQualified` tozalanadi.
 *
 * Ball chegara ballga (super admin belgilaydi) yetgan o'quvchi shu oygi o'yinga
 * "yopishqoq" qo'shiladi (keyin ball tushsa ham oy oxirigacha qoladi) va xabar oladi.
 */
@Injectable()
export class GameService implements OnModuleInit {
  private readonly logger = new Logger(GameService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  /** Joriy (yoki berilgan) sananing davr kaliti: "YYYY-MM" */
  static periodKey(d = new Date()): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  private static parsePeriod(key: string): { year: number; month: number } {
    const [year, month] = key.split('-').map(Number);
    return { year, month };
  }

  // ---------- Oylik reset ----------

  /** Server ko'tarilganда: o'chiq turgan payt oy almashган bo'lsa — ushlab qolinganlarni yangilaydi */
  async onModuleInit(): Promise<void> {
    try {
      const n = await this.rolloverStale();
      if (n > 0) this.logger.log(`Boshlang'ich oylik reset: ${n} o'quvchi yangilandi`);
    } catch (e) {
      this.logger.warn(`Boshlang'ich oylik reset o'tkazilmadi: ${String(e)}`);
    }
  }

  /** Har oyning 1-kuni 00:05 da avtomatik oylik reset */
  @Cron('5 0 1 * *', { timeZone: 'Asia/Tashkent' })
  async monthlyReset(): Promise<void> {
    const n = await this.rolloverStale();
    this.logger.log(`Oylik reset (cron): ${n} o'quvchi balli yangilandi`);
  }

  /**
   * pointsPeriod joriy oydan farq qiladigan barcha o'quvchilarni arxivlab reset qiladi.
   * Idempotent — bir necha marta chaqirilsa ham xavfsiz (upsert + shartli update).
   */
  async rolloverStale(): Promise<number> {
    const current = GameService.periodKey();
    const stale = await this.prisma.studentProfile.findMany({
      where: { OR: [{ pointsPeriod: { not: current } }, { pointsPeriod: null }] },
      select: { userId: true },
    });
    let rolled = 0;
    for (const s of stale) {
      const done = await this.prisma.$transaction((tx) => this.ensureCurrentPeriod(tx, s.userId));
      if (done) rolled++;
    }
    return rolled;
  }

  /**
   * Bitta o'quvchini joriy oyga keltiradi (kerak bo'lsa arxivlab reset qiladi).
   * `client` — tranzaksiya klienti yoki PrismaService. Ball o'zgartirishdan OLDIN chaqiriladi.
   * Profil tranzaksiya ICHIDA qayta o'qiladi — chaqiruvchi snapshotiga tayanmaymiz,
   * chunki u eskirgan bo'lishi mumkin. Reset shartli updateMany bilan guard qilinadi:
   * birinchi yozuvchi g'olib, count===0 bo'lsa boshqa yozuvchi allaqachon yangi davrni
   * ochgan bo'ladi va biz uning ustiga yozmaymiz (ikki marta arxivlash ham bo'lmaydi).
   */
  async ensureCurrentPeriod(
    client: Prisma.TransactionClient,
    studentUserId: string,
  ): Promise<boolean> {
    const current = GameService.periodKey();
    const student = await client.studentProfile.findUnique({
      where: { userId: studentUserId },
      select: { userId: true, pointsPeriod: true, currentPoints: true, gameQualified: true },
    });
    if (!student || student.pointsPeriod === current) return false;

    // Feature'dan oldin yaratilган o'quvchi (pointsPeriod hali yo'q):
    // ballini saqlagan holda joriy oyga "qabul qilamiz", arxivlamaymiz.
    if (student.pointsPeriod == null) {
      const res = await client.studentProfile.updateMany({
        where: { userId: student.userId, pointsPeriod: null },
        data: { pointsPeriod: current },
      });
      return res.count > 0;
    }

    // Haqiqiy oy almashuvi: o'tgan oyni arxivlab, ballni boshlang'ichга qaytaramiz.
    const stalePeriod = student.pointsPeriod;
    const initial = await this.settings.getNumber(SETTING_KEYS.initialPoints);
    const { year, month } = GameService.parsePeriod(stalePeriod);
    await client.monthlyPointsArchive.upsert({
      where: { studentId_year_month: { studentId: student.userId, year, month } },
      update: { points: student.currentPoints, qualified: student.gameQualified },
      create: {
        studentId: student.userId,
        year,
        month,
        points: student.currentPoints,
        qualified: student.gameQualified,
      },
    });
    const res = await client.studentProfile.updateMany({
      where: { userId: student.userId, pointsPeriod: stalePeriod },
      data: { currentPoints: initial, pointsPeriod: current, gameQualified: false, qualifiedAt: null },
    });
    return res.count > 0;
  }

  // ---------- O'yinga qo'shilish ----------

  /**
   * Ball chegaraga yetган bo'lsa o'quvchini shu oygi o'yinga qo'shadi (bir marta) va xabar yuboradi.
   * Ball qo'shilгандан keyin chaqiriladi. `actorId` — ball bergan xodim (null = tizim).
   */
  async checkAndQualify(
    actorId: string | null,
    studentUserId: string,
    points: number,
    studentName: string,
  ): Promise<boolean> {
    const threshold = await this.settings.getNumber(SETTING_KEYS.gameThreshold);
    if (points < threshold) return false;

    // Atomik: faqat hali qo'shilmagan bo'lsa belgilaydi (ikki marta xabar ketmasligi uchun)
    const res = await this.prisma.studentProfile.updateMany({
      where: { userId: studentUserId, gameQualified: false },
      data: { gameQualified: true, qualifiedAt: new Date() },
    });
    if (res.count === 0) return false;

    await this.notifications.notify(
      studentUserId,
      'game',
      `Tabriklaymiz! Siz shu oylik o'yinga qo'shildingiz. Joriy ball: ${points} (chegara: ${threshold}). Oy oxiridagi o'yinni kuting!`,
    );
    await this.notifications.notifyParents(
      studentUserId,
      'game',
      `Farzandingiz ${studentName} shu oylik o'yinga qo'shildi (joriy ball: ${points}).`,
    );
    await this.audit.log({
      userId: actorId,
      action: 'game.qualify',
      entity: 'studentProfile',
      entityId: studentUserId,
      newValue: { points, threshold },
    });
    return true;
  }

  // ---------- Ro'yxat / status ----------

  /** Berilgan oy uchun o'yinga qo'shilганlar ro'yxati (joriy oy — jonli, o'tgan oy — arxivdan) */
  async roster(year?: number, month?: number) {
    const now = new Date();
    const y = year ?? now.getFullYear();
    const m = month ?? now.getMonth() + 1;
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const threshold = await this.settings.getNumber(SETTING_KEYS.gameThreshold);

    if (key === GameService.periodKey()) {
      const rows = await this.prisma.studentProfile.findMany({
        where: { gameQualified: true, pointsPeriod: key, user: { isActive: true } },
        include: { user: { select: { name: true, phone: true } }, group: { select: { name: true } } },
        orderBy: [{ currentPoints: 'desc' }, { qualifiedAt: 'asc' }],
      });
      return {
        year: y,
        month: m,
        current: true,
        threshold,
        count: rows.length,
        students: rows.map((r) => ({
          studentId: r.userId,
          name: r.user.name,
          phone: r.user.phone,
          group: r.group?.name ?? null,
          points: r.currentPoints,
          qualifiedAt: r.qualifiedAt,
        })),
      };
    }

    const rows = await this.prisma.monthlyPointsArchive.findMany({
      where: { year: y, month: m, qualified: true, student: { user: { isActive: true } } },
      include: {
        student: {
          include: { user: { select: { name: true, phone: true } }, group: { select: { name: true } } },
        },
      },
      orderBy: [{ points: 'desc' }],
    });
    return {
      year: y,
      month: m,
      current: false,
      threshold,
      count: rows.length,
      students: rows.map((r) => ({
        studentId: r.studentId,
        name: r.student.user.name,
        phone: r.student.user.phone,
        group: r.student.group?.name ?? null,
        points: r.points,
        qualifiedAt: null,
      })),
    };
  }

  /** Ro'yxatning CSV ko'rinishi (Excel uchun) */
  async rosterCsv(year?: number, month?: number): Promise<string> {
    const data = await this.roster(year, month);
    return toCsv(
      ['#', 'Ism', 'Telefon', 'Guruh', 'Ball', "Qo'shilgan sana"],
      data.students.map((s, i) => [
        i + 1,
        s.name,
        s.phone,
        s.group ?? '',
        s.points,
        s.qualifiedAt ? new Date(s.qualifiedAt).toISOString().slice(0, 10) : '',
      ]),
    );
  }

  /** O'quvchining o'zi uchun: joriy ball, chegara, o'yinga qo'shilganmi, yetishmayotган ball */
  async status(studentUserId: string) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId: studentUserId },
      select: { currentPoints: true, gameQualified: true, pointsPeriod: true, qualifiedAt: true },
    });
    if (!profile) throw new AppException('STUDENT_NOT_FOUND', "O'quvchi topilmadi", 404);

    const threshold = await this.settings.getNumber(SETTING_KEYS.gameThreshold);
    const current = GameService.periodKey();

    // Oy almashган-u hali reset qilinmagan bo'lsa, bu oy uchun ball boshlang'ichdan hisoblanadi
    const stalePastPeriod = profile.pointsPeriod !== current && profile.pointsPeriod !== null;
    const points = stalePastPeriod
      ? await this.settings.getNumber(SETTING_KEYS.initialPoints)
      : profile.currentPoints;
    const qualified = stalePastPeriod ? false : profile.gameQualified;

    const { year, month } = GameService.parsePeriod(current);
    return {
      year,
      month,
      points,
      threshold,
      qualified,
      remaining: Math.max(0, threshold - points),
      qualifiedAt: qualified ? profile.qualifiedAt : null,
    };
  }
}
