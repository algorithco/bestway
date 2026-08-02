import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/app.exception';
import { CurrentUser, Roles } from '../common/decorators';
import { Paginated } from '../common/pagination';
import { AuthUser } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { BroadcastDto } from './dto/broadcast.dto';
import { QueryNotificationsDto } from './dto/notifications.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  /** Joriy foydalanuvchining bildirishnomalari (eng yangilari birinchi) */
  @Get()
  async list(@CurrentUser() user: AuthUser, @Query() q: QueryNotificationsDto) {
    const where: Prisma.NotificationWhereInput = {
      userId: user.id,
      ...(q.unreadOnly ? { read: false } : {}),
      ...(q.type ? { type: q.type } : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.limit,
      }),
    ]);
    return new Paginated(
      items.map((n) => ({ id: n.id, type: n.type, text: n.text, read: n.read, date: n.createdAt })),
      { page: q.page, limit: q.limit, total },
    );
  }

  /**
   * Ommaviy e'lon yuborish (in-app + Telegram).
   * audience: all | role | group | debtors
   */
  @Roles('admin', 'super_admin')
  @Post('broadcast')
  @HttpCode(200)
  async broadcast(@CurrentUser() user: AuthUser, @Body() dto: BroadcastDto) {
    const result = await this.notifications.broadcast(dto);
    await this.audit.log({
      userId: user.id,
      action: 'notification.broadcast',
      entity: 'notification',
      newValue: {
        audience: dto.audience,
        role: dto.role,
        groupId: dto.groupId,
        notified: result.notified,
        text: dto.text.slice(0, 200),
      },
    });
    return result;
  }

  // Diqqat: 'read-all' marshruti ':id/read' bilan to'qnashmaydi, lekin tartib saqlanadi
  /** Barcha bildirishnomalarni "o'qilgan" deb belgilash (qo'ng'iroq belgisi uchun) */
  @Patch('read-all')
  async markAllRead(@CurrentUser() user: AuthUser) {
    const res = await this.prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
    return { updated: res.count };
  }

  /** Bildirishnomani "o'qilgan" deb belgilash */
  @Patch(':id/read')
  async markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n || n.userId !== user.id) {
      throw new AppException('NOTIFICATION_NOT_FOUND', 'Bildirishnoma topilmadi', 404);
    }
    await this.prisma.notification.update({ where: { id }, data: { read: true } });
    return { read: true };
  }
}
