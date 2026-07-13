import { Injectable } from '@nestjs/common';
import { monthRangeUtc } from '../common/date.util';
import { PrismaService } from '../prisma/prisma.service';

/** Excel to'g'ri ochishi uchun BOM + nuqta-vergul ajratgich */
function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null): string => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(';'), ...rows.map((r) => r.map(esc).join(';'))];
  return '﻿' + lines.join('\r\n');
}

const STATE_UZ: Record<string, string> = {
  present: 'Keldi',
  absent: 'Kelmadi',
  late: 'Kechikdi',
  paid: "To'langan",
  unpaid: "To'lanmagan",
  partial: 'Qisman',
};

/**
 * Excel/Google Sheets uchun CSV eksport.
 * Admin hisobot tayyorlashda ma'lumotni qo'lda ko'chirmasligi uchun.
 */
@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  async students(groupId?: string): Promise<string> {
    const rows = await this.prisma.studentProfile.findMany({
      where: { ...(groupId ? { groupId } : {}), user: { isActive: true } },
      include: {
        user: { select: { name: true, phone: true, createdAt: true } },
        group: { select: { name: true } },
        parents: { include: { parent: { select: { name: true, phone: true } } } },
      },
      orderBy: { user: { name: 'asc' } },
    });

    return toCsv(
      ['Ism', 'Telefon', 'Guruh', 'Ball', 'Tasdiqlangan', 'Ota-ona', 'Ota-ona tel', "Ro'yxatdan o'tgan"],
      rows.map((s) => [
        s.user.name,
        s.user.phone,
        s.group?.name ?? '',
        s.currentPoints,
        s.isApproved ? 'Ha' : "Yo'q",
        s.parents.map((p) => p.parent.name).join(', '),
        s.parents.map((p) => p.parent.phone).join(', '),
        s.user.createdAt.toISOString().slice(0, 10),
      ]),
    );
  }

  async payments(year: number, month?: number): Promise<string> {
    const rows = await this.prisma.payment.findMany({
      where: { year, ...(month ? { month } : {}) },
      include: {
        student: {
          include: { user: { select: { name: true, phone: true } }, group: { select: { name: true } } },
        },
      },
      orderBy: [{ month: 'asc' }, { student: { user: { name: 'asc' } } }],
    });

    // markedById — oddiy maydon (relatsiya emas), ismlarni alohida olamiz
    const ids = [...new Set(rows.map((r) => r.markedById).filter((x): x is string => Boolean(x)))];
    const staff = ids.length
      ? await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
      : [];
    const nameById = new Map(staff.map((u) => [u.id, u.name]));

    return toCsv(
      ['Oy', 'Yil', 'Ism', 'Telefon', 'Guruh', 'Holat', 'Summa', 'Izoh', 'Kim belgiladi'],
      rows.map((p) => [
        p.month,
        p.year,
        p.student.user.name,
        p.student.user.phone,
        p.student.group?.name ?? '',
        STATE_UZ[p.state] ?? p.state,
        p.amount,
        p.note ?? '',
        p.markedById ? (nameById.get(p.markedById) ?? '') : '',
      ]),
    );
  }

  async attendance(groupId: string, month?: string): Promise<string> {
    const [y, m] = month ? (month.split('-').map(Number) as [number, number]) : [undefined, undefined];
    const { gte, lt } = monthRangeUtc(y, m);

    const rows = await this.prisma.attendance.findMany({
      where: { groupId, date: { gte, lt } },
      include: { student: { include: { user: { select: { name: true } } } } },
      orderBy: [{ date: 'asc' }, { student: { user: { name: 'asc' } } }],
    });

    return toCsv(
      ['Sana', 'Ism', 'Holat'],
      rows.map((a) => [
        a.date.toISOString().slice(0, 10),
        a.student.user.name,
        STATE_UZ[a.state] ?? a.state,
      ]),
    );
  }
}
