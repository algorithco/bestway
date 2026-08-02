import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { AppException } from '../common/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { BroadcastDto } from './dto/broadcast.dto';

/**
 * Bildirishnomalar: har doim in-app (bazaga) yoziladi,
 * telegramChatId bog'langan bo'lsa Telegramga ham fonda yuboriladi.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
  ) {}

  async notify(userId: string, type: NotificationType, text: string): Promise<void> {
    await this.notifyMany([userId], type, text);
  }

  async notifyMany(userIds: string[], type: NotificationType, text: string): Promise<void> {
    const unique = [...new Set(userIds)].filter(Boolean);
    if (unique.length === 0) return;
    await this.prisma.notification.createMany({
      data: unique.map((userId) => ({ userId, type, text })),
    });
    // Telegram fonda — xatolik asosiy oqimni to'xtatmaydi
    void this.sendTelegrams(unique, type, text);
  }

  /**
   * Ommaviy e'lon (admin paneli).
   * Kimlarga: hamma / rol / guruh / joriy oy qarzdorlari (+ ixtiyoriy ota-onalar).
   */
  async broadcast(dto: BroadcastDto): Promise<{ notified: number }> {
    const studentIds = await this.broadcastStudentIds(dto);
    let userIds: string[];

    if (dto.audience === 'all') {
      const users = await this.prisma.user.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
    } else if (dto.audience === 'role') {
      if (!dto.role) throw new AppException('ROLE_REQUIRED', 'Rol tanlanmagan', 400);
      const users = await this.prisma.user.findMany({
        where: { isActive: true, role: dto.role },
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
    } else {
      userIds = [...studentIds];
      if (dto.includeParents && studentIds.length > 0) {
        const links = await this.prisma.parentStudent.findMany({
          where: { studentId: { in: studentIds } },
          select: { parentUserId: true },
        });
        userIds.push(...links.map((l) => l.parentUserId));
      }
    }

    const unique = [...new Set(userIds)];
    if (unique.length === 0) return { notified: 0 };

    await this.notifyMany(unique, 'announcement', dto.text);
    return { notified: unique.length };
  }

  private async broadcastStudentIds(dto: BroadcastDto): Promise<string[]> {
    if (dto.audience === 'group') {
      if (!dto.groupId) throw new AppException('GROUP_ID_REQUIRED', 'Guruh tanlanmagan', 400);
      const rows = await this.prisma.studentProfile.findMany({
        where: { groupId: dto.groupId, user: { isActive: true } },
        select: { userId: true },
      });
      return rows.map((r) => r.userId);
    }
    if (dto.audience === 'debtors') {
      const now = new Date();
      const rows = await this.prisma.studentProfile.findMany({
        where: {
          user: { isActive: true },
          groupId: { not: null },
          NOT: {
            payments: {
              some: { year: now.getFullYear(), month: now.getMonth() + 1, state: 'paid' },
            },
          },
        },
        select: { userId: true },
      });
      return rows.map((r) => r.userId);
    }
    return [];
  }

  /** O'quvchining bog'langan ota-onalariga xabar */
  async notifyParents(studentUserId: string, type: NotificationType, text: string): Promise<void> {
    const links = await this.prisma.parentStudent.findMany({
      where: { studentId: studentUserId },
    });
    await this.notifyMany(
      links.map((l) => l.parentUserId),
      type,
      text,
    );
  }

  /** Telegram xabarining sarlavhasi — turiga qarab */
  private decorate(type: NotificationType, text: string): string {
    const head: Record<NotificationType, string> = {
      points: '🏆 <b>Ball o\'zgardi</b>',
      attendance: '📅 <b>Davomat</b>',
      payment_reminder: "💰 <b>To'lov eslatmasi</b>",
      test_result: '📝 <b>Test natijasi</b>',
      announcement: "📢 <b>E'lon</b>",
      game: "🎮 <b>Oylik o'yin</b>",
    };
    // HTML rejimida foydalanuvchi matnidagi < > belgilari xatolik bermasligi uchun
    const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `${head[type]}\n➖➖➖➖➖➖➖➖➖\n\n${safe}`;
  }

  private async sendTelegrams(
    userIds: string[],
    type: NotificationType,
    text: string,
  ): Promise<void> {
    try {
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds }, telegramChatId: { not: null } },
        select: { telegramChatId: true },
      });
      if (users.length === 0) return;
      const message = this.decorate(type, text);
      await Promise.all(users.map((u) => this.telegram.send(u.telegramChatId as string, message)));
    } catch (e) {
      this.logger.warn(`Telegram xabarlari yuborilmadi: ${String(e)}`);
    }
  }
}
