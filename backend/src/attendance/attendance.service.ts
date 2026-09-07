import { Injectable } from '@nestjs/common';
import { AttendanceState, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AccessService } from '../common/access.service';
import { AppException } from '../common/app.exception';
import { AuthUser } from '../common/types';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AttendanceRecordDto,
  AttendanceStatsQueryDto,
  BulkAttendanceDto,
  isEmptyAttendanceState,
  QueryAttendanceDto,
} from './dto/attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private monthRange(month?: string): { gte: Date; lt: Date } {
    const now = new Date();
    const [y, m] = month ? month.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1];
    return { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
  }

  async list(viewer: AuthUser, q: QueryAttendanceDto) {
    const range = this.monthRange(q.month);
    const where: Prisma.AttendanceWhereInput = { date: { gte: range.gte, lt: range.lt } };

    if (viewer.role === 'student') {
      where.studentId = viewer.id;
      if (q.groupId) where.groupId = q.groupId;
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
    } else {
      // teacher / admin / super_admin — jadval guruh bo'yicha ochiladi
      if (!q.groupId) {
        throw new AppException('GROUP_ID_REQUIRED', "groupId ko'rsatilishi shart", 400);
      }
      await this.access.assertCanManageGroup(viewer, q.groupId);
      where.groupId = q.groupId;
      if (q.studentId) where.studentId = q.studentId;
    }

    const rows = await this.prisma.attendance.findMany({ where, orderBy: { date: 'asc' } });
    // Kontrakt shakli: [{ studentId, date, state }]
    return rows.map((r) => ({
      studentId: r.studentId,
      date: r.date.toISOString().slice(0, 10),
      state: r.state,
    }));
  }

  /** PUT /attendance/bulk — bitta so'rovda butun kunlik davomat */
  async bulkUpsert(actor: AuthUser, dto: BulkAttendanceDto) {
    await this.access.assertCanManageGroup(actor, dto.groupId);
    const date = new Date(dto.date.slice(0, 10));

    // Barcha o'quvchilar shu guruhda ekanini tekshirish
    const members = await this.prisma.studentProfile.findMany({
      where: { groupId: dto.groupId },
      select: { userId: true },
    });
    const memberIds = new Set(members.map((m) => m.userId));
    for (const r of dto.records) {
      if (!memberIds.has(r.studentId)) {
        throw new AppException('STUDENT_NOT_IN_GROUP', "Ro'yxatda guruhga tegishli bo'lmagan o'quvchi bor", 400);
      }
    }

    const existing = await this.prisma.attendance.findMany({
      where: {
        groupId: dto.groupId,
        date,
        studentId: { in: dto.records.map((r) => r.studentId) },
      },
    });
    const prev = new Map(existing.map((e) => [e.studentId, e.state]));

    // 'empty'/'blank' — tozalash: yozuv upsert emas, o'chiriladi (DB enum'da yo'q)
    type MarkedRecord = AttendanceRecordDto & { state: AttendanceState };
    const toUpsert = dto.records.filter((r): r is MarkedRecord => !isEmptyAttendanceState(r.state));
    const toClear = dto.records.filter((r) => isEmptyAttendanceState(r.state));

    await this.prisma.$transaction([
      ...toUpsert.map((r) =>
        this.prisma.attendance.upsert({
          where: {
            studentId_groupId_date: { studentId: r.studentId, groupId: dto.groupId, date },
          },
          update: { state: r.state, markedById: actor.id },
          create: {
            studentId: r.studentId,
            groupId: dto.groupId,
            date,
            state: r.state,
            markedById: actor.id,
          },
        }),
      ),
      ...(toClear.length > 0
        ? [
            this.prisma.attendance.deleteMany({
              where: {
                groupId: dto.groupId,
                date,
                studentId: { in: toClear.map((r) => r.studentId) },
              },
            }),
          ]
        : []),
    ]);

    // Yangi "kelmadi" deb belgilanganlarning ota-onasiga avtomatik xabar
    const newlyAbsent = dto.records.filter(
      (r) => r.state === 'absent' && prev.get(r.studentId) !== 'absent',
    );
    if (newlyAbsent.length > 0) {
      const students = await this.prisma.user.findMany({
        where: { id: { in: newlyAbsent.map((r) => r.studentId) } },
        select: { id: true, name: true },
      });
      const nameById = new Map(students.map((s) => [s.id, s.name]));
      const dateStr = date.toISOString().slice(0, 10);
      await Promise.all(
        newlyAbsent.map((r) =>
          this.notifications.notifyParents(
            r.studentId,
            'attendance',
            `Farzandingiz ${nameById.get(r.studentId) ?? ''} ${dateStr} kungi darsga kelmadi.`,
          ),
        ),
      );
    }

    await this.audit.log({
      userId: actor.id,
      action: 'attendance.bulk_update',
      entity: 'group',
      entityId: dto.groupId,
      newValue: { date: dto.date.slice(0, 10), records: dto.records.length },
    });

    return { updated: toUpsert.length, cleared: toClear.length };
  }

  /** Oylik statistika: har bir o'quvchi bo'yicha keldi/kelmadi/kechikdi soni */
  async stats(viewer: AuthUser, q: AttendanceStatsQueryDto) {
    await this.access.assertCanManageGroup(viewer, q.groupId);
    const range = this.monthRange(q.month);
    const rows = await this.prisma.attendance.findMany({
      where: { groupId: q.groupId, date: { gte: range.gte, lt: range.lt } },
      include: { student: { include: { user: { select: { name: true } } } } },
    });

    const byStudent = new Map<
      string,
      { studentId: string; name: string; present: number; absent: number; late: number }
    >();
    for (const r of rows) {
      const entry = byStudent.get(r.studentId) ?? {
        studentId: r.studentId,
        name: r.student.user.name,
        present: 0,
        absent: 0,
        late: 0,
      };
      if (r.state === ('present' as AttendanceState)) entry.present++;
      else if (r.state === ('absent' as AttendanceState)) entry.absent++;
      else entry.late++;
      byStudent.set(r.studentId, entry);
    }
    return [...byStudent.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
}
