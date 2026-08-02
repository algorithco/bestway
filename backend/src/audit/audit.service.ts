import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
}

/**
 * Muhim o'zgarishlar jurnali (backend-prompt.md, 7-band):
 * foydalanuvchi o'chirish, to'lov holati, ball berish va h.k.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Jurnalga yozadi; xato bo'lsa asosiy amalni to'xtatmaydi */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId ?? null,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId,
          oldValue:
            entry.oldValue == null ? undefined : (entry.oldValue as Prisma.InputJsonValue),
          newValue:
            entry.newValue == null ? undefined : (entry.newValue as Prisma.InputJsonValue),
        },
      });
    } catch (e) {
      this.logger.warn(`Audit yozilmadi: ${String(e)}`);
    }
  }
}
