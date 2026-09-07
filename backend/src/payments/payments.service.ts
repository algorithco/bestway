import { Injectable } from '@nestjs/common';
import { PaymentState, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AccessService } from '../common/access.service';
import { AppException } from '../common/app.exception';
import { AuthUser } from '../common/types';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { BulkPaymentsDto, DebtorsQueryDto, QueryPaymentsDto, RemindDto } from './dto/payments.dto';

export const UZ_MONTHS = [
  'yanvar',
  'fevral',
  'mart',
  'aprel',
  'may',
  'iyun',
  'iyul',
  'avgust',
  'sentabr',
  'oktabr',
  'noyabr',
  'dekabr',
];

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(viewer: AuthUser, q: QueryPaymentsDto) {
    const where: Prisma.PaymentWhereInput = {
      ...(q.year ? { year: q.year } : {}),
      ...(q.month ? { month: q.month } : {}),
      ...(q.state ? { state: q.state } : {}),
    };

    if (viewer.role === 'student') {
      where.studentId = viewer.id;
    } else if (viewer.role === 'parent') {
      const kids = await this.access.childUserIds(viewer.id);
      if (q.studentId) {
        if (!kids.includes(q.studentId)) {
          throw new AppException('FORBIDDEN', "Bu o'quvchi sizga bog'lanmagan", 403);
        }
        where.studentId = q.studentId;
      } else {
        where.studentId = { in: kids };
      }
    } else if (q.studentId) {
      where.studentId = q.studentId;
    }

    const rows = await this.prisma.payment.findMany({
      where,
      include: { student: { include: { user: { select: { name: true } } } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    // Kontrakt shakli: { studentId, month, year, state, amount, method, note }
    return rows.map((p) => ({
      studentId: p.studentId,
      studentName: p.student.user.name,
      month: p.month,
      year: p.year,
      state: p.state,
      amount: p.amount,
      method: p.method,
      note: p.note,
    }));
  }

  /**
   * PUT /payments/bulk — to'lov holatlari faqat qo'lda belgilanadi
   * (backend-prompt.md 8-band: onlayn to'lov YO'Q, kelajak uchun method maydoni bor).
   */
  async bulkUpsert(actor: AuthUser, dto: BulkPaymentsDto) {
    const ids = [...new Set(dto.records.map((r) => r.studentId))];
    const profiles = await this.prisma.studentProfile.findMany({
      where: { userId: { in: ids } },
      select: { userId: true },
    });
    const known = new Set(profiles.map((p) => p.userId));
    for (const r of dto.records) {
      if (!known.has(r.studentId)) {
        throw new AppException('STUDENT_NOT_FOUND', "Ro'yxatda mavjud bo'lmagan o'quvchi bor", 400);
      }
    }

    const existing = await this.prisma.payment.findMany({
      where: {
        year: dto.year,
        studentId: { in: ids },
        month: { in: [...new Set(dto.records.map((r) => r.month))] },
      },
    });
    const prev = new Map(existing.map((e) => [`${e.studentId}:${e.month}`, e]));

    // `empty` — client-only holat: DB yozuvini o'chirish (holat hali qayd etilmagan).
    // Payment.state nullable emas va enum'da `empty` yo'q — shuning uchun Empty = yozuv yo'qligi.
    const upserts = dto.records.filter((r) => r.state !== 'empty');
    const clears = dto.records.filter((r) => r.state === 'empty');

    await this.prisma.$transaction([
      ...upserts.map((r) =>
        this.prisma.payment.upsert({
          where: {
            studentId_month_year: { studentId: r.studentId, month: r.month, year: dto.year },
          },
          update: {
            state: r.state as PaymentState,
            ...(r.amount !== undefined ? { amount: r.amount } : {}),
            note: r.note ?? null,
            markedById: actor.id,
          },
          create: {
            studentId: r.studentId,
            month: r.month,
            year: dto.year,
            state: r.state as PaymentState,
            amount: r.amount ?? 0,
            note: r.note,
            markedById: actor.id,
          },
        }),
      ),
      ...clears.map((r) =>
        this.prisma.payment.deleteMany({
          where: { studentId: r.studentId, month: r.month, year: dto.year },
        }),
      ),
    ]);

    // Audit: faqat haqiqatda o'zgarganlarni yozamiz
    for (const r of dto.records) {
      const old = prev.get(`${r.studentId}:${r.month}`);
      if (r.state === 'empty') {
        if (old) {
          await this.audit.log({
            userId: actor.id,
            action: 'payment.set',
            entity: 'payment',
            entityId: `${r.studentId}:${dto.year}-${r.month}`,
            oldValue: { state: old.state, amount: old.amount },
            newValue: { state: 'empty' },
          });
        }
        continue;
      }
      if (!old || old.state !== r.state || old.amount !== (r.amount ?? 0)) {
        await this.audit.log({
          userId: actor.id,
          action: 'payment.set',
          entity: 'payment',
          entityId: `${r.studentId}:${dto.year}-${r.month}`,
          oldValue: old ? { state: old.state, amount: old.amount } : undefined,
          newValue: { state: r.state, amount: r.amount ?? 0 },
        });
      }
    }

    return { updated: dto.records.length };
  }

  /** month/year berilmasa joriy oy olinadi */
  private resolvePeriod(q: { month?: number; year?: number }): { month: number; year: number } {
    const now = new Date();
    return { month: q.month ?? now.getMonth() + 1, year: q.year ?? now.getFullYear() };
  }

  /** To'lanmagan/qisman to'langan o'quvchilar ro'yxati (eslatma paneli uchun) */
  async debtors(q: DebtorsQueryDto) {
    const { month, year } = this.resolvePeriod(q);
    const students = await this.prisma.studentProfile.findMany({
      where: { user: { isActive: true }, groupId: { not: null } },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        group: { select: { name: true } },
      },
    });
    const payments = await this.prisma.payment.findMany({
      where: { year, month },
    });
    const payMap = new Map(payments.map((p) => [p.studentId, p]));

    return students
      .filter((s) => payMap.get(s.userId)?.state !== 'paid')
      .map((s) => {
        const p = payMap.get(s.userId);
        return {
          studentId: s.userId,
          name: s.user.name,
          phone: s.user.phone,
          groupName: s.group?.name ?? null,
          // Yozuv yo'q = Empty (hali qayd etilmagan) — `unpaid` (qayd etilgan qarzdorlik) bilan adashtirmaslik!
          state: p?.state ?? 'empty',
          amount: p?.amount ?? 0,
          note: p?.note ?? null,
        };
      });
  }

  /**
   * Qarzdorlarga (va ota-onalariga) bir tugma bilan eslatma yuborish.
   * studentIds berilsa — faqat o'shalarga, aks holda barcha qarzdorlarga.
   */
  async remind(actor: AuthUser, dto: RemindDto) {
    const { month, year } = this.resolvePeriod(dto);
    const all = await this.debtors({ month, year });
    const targets = dto.studentIds?.length
      ? all.filter((d) => dto.studentIds!.includes(d.studentId))
      : all;
    const monthName = UZ_MONTHS[month - 1];

    for (const d of targets) {
      await this.notifications.notify(
        d.studentId,
        'payment_reminder',
        `To'lov eslatmasi: ${year}-yil ${monthName} oyi uchun to'lov qayd etilmagan. Iltimos, administratsiyaga murojaat qiling.`,
      );
      await this.notifications.notifyParents(
        d.studentId,
        'payment_reminder',
        `Farzandingiz ${d.name} uchun ${year}-yil ${monthName} oyi to'lovi qayd etilmagan.`,
      );
    }

    await this.audit.log({
      userId: actor.id,
      action: 'payment.remind',
      entity: 'payment',
      newValue: { year, month, notified: targets.length },
    });

    return { notified: targets.length };
  }
}
