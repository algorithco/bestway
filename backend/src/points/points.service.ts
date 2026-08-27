import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AccessService } from '../common/access.service';
import { AppException } from '../common/app.exception';
import { AuthUser } from '../common/types';
import { GameService } from '../game/game.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SETTING_KEYS, SettingsService } from '../settings/settings.service';
import { AdjustPointsDto, LeaderboardQueryDto } from './dto/points.dto';

@Injectable()
export class PointsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly game: GameService,
  ) {}

  /** GET /points/:studentId — joriy ball + tarix */
  async getPoints(viewer: AuthUser, studentUserId: string) {
    await this.access.assertCanViewStudent(viewer, studentUserId);
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId: studentUserId },
    });
    if (!profile) throw new AppException('STUDENT_NOT_FOUND', "O'quvchi topilmadi", 404);

    const history = await this.prisma.pointsLog.findMany({
      where: { studentId: studentUserId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const byIds = [...new Set(history.map((h) => h.byUserId).filter((x): x is string => Boolean(x)))];
    const users = byIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: byIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(users.map((u) => [u.id, u.name]));

    return {
      current: profile.currentPoints,
      history: history.map((h) => ({
        change: h.change,
        reason: h.reason,
        byUserId: h.byUserId,
        byUserName: h.byUserId ? (nameById.get(h.byUserId) ?? null) : 'Tizim',
        date: h.createdAt,
      })),
    };
  }

  /**
   * POST /points/:studentId/adjust
   * Biznes-qoidalar: sabab majburiy; o'qituvchi faqat o'z guruhidagi o'quvchiga,
   * super admin belgilagan limit doirasida (standart ±20) ball beradi.
   */
  async adjust(actor: AuthUser, studentUserId: string, dto: AdjustPointsDto) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId: studentUserId },
      include: {
        group: { select: { teacherId: true } },
        user: { select: { name: true } },
      },
    });
    if (!profile) throw new AppException('STUDENT_NOT_FOUND', "O'quvchi topilmadi", 404);

    if (actor.role === 'teacher') {
      if (profile.group?.teacherId !== actor.id) {
        throw new AppException('FORBIDDEN', "Bu o'quvchi sizning guruhingizda emas", 403);
      }
      const limit = await this.settings.getNumber(SETTING_KEYS.teacherPointLimit);
      if (Math.abs(dto.change) > limit) {
        throw new AppException(
          'POINT_LIMIT_EXCEEDED',
          `O'qituvchi bir amalda ko'pi bilan ±${limit} ball o'zgartira oladi`,
          403,
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Oy almashgan bo'lsa — avval o'tgan oyni arxivlab, ballni yangi oydan boshlaymiz
      // (profil tranzaksiya ichida qayta o'qiladi, snapshot eskirgan bo'lishi mumkin)
      await this.game.ensureCurrentPeriod(tx, studentUserId);
      const u = await tx.studentProfile.update({
        where: { userId: studentUserId },
        data: { currentPoints: { increment: dto.change } },
      });
      await tx.pointsLog.create({
        data: {
          studentId: studentUserId,
          change: dto.change,
          reason: dto.reason,
          byUserId: actor.id,
        },
      });
      return u;
    });

    const oldPoints = updated.currentPoints - dto.change;
    const sign = dto.change > 0 ? '+' : '';
    // Commit'dan keyingi xabarlar — fire-and-forget: xato javobni 500 ga aylantirmasin
    this.notifications.safeNotify(
      studentUserId,
      'points',
      `Ball o'zgarishi: ${sign}${dto.change} (${dto.reason}). Joriy ball: ${updated.currentPoints}.`,
    );
    this.notifications.safeNotifyParents(
      studentUserId,
      'points',
      `Farzandingiz ${profile.user.name} balli o'zgardi: ${sign}${dto.change} (${dto.reason}). Joriy ball: ${updated.currentPoints}.`,
    );
    await this.audit.log({
      userId: actor.id,
      action: 'points.adjust',
      entity: 'studentProfile',
      entityId: studentUserId,
      oldValue: { points: oldPoints },
      newValue: { points: updated.currentPoints, change: dto.change, reason: dto.reason },
    });

    // Chegara ballga yetgan bo'lsa — shu oygi o'yinga qo'shamiz va xabar yuboramiz
    await this.game.checkAndQualify(actor.id, studentUserId, updated.currentPoints, profile.user.name);

    return { current: updated.currentPoints };
  }

  /** GET /points/leaderboard — guruh yoki butun markaz bo'yicha reyting */
  async leaderboard(q: LeaderboardQueryDto) {
    const rows = await this.prisma.studentProfile.findMany({
      where: { user: { isActive: true }, ...(q.groupId ? { groupId: q.groupId } : {}) },
      orderBy: [{ currentPoints: 'desc' }, { createdAt: 'asc' }],
      take: q.limit ?? 50,
      include: { user: { select: { name: true } } },
    });

    let rank = 0;
    let prevPoints: number | null = null;
    return rows.map((r, i) => {
      if (r.currentPoints !== prevPoints) {
        rank = i + 1;
        prevPoints = r.currentPoints;
      }
      return { studentId: r.userId, name: r.user.name, points: r.currentPoints, rank };
    });
  }
}
