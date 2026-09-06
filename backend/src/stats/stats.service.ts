import { Injectable } from '@nestjs/common';
import { todayDateOnly } from '../common/date.util';
import { PrismaService } from '../prisma/prisma.service';

/** Admin panelining bosh sahifasi uchun umumiy ko'rsatkichlar */
@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    // Davomat sanasi UTC yarim tunda saqlanadi — solishtirish ham shunday bo'lishi kerak
    const today = todayDateOnly();
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const [
      students,
      approvedStudents,
      teachers,
      parents,
      groups,
      todayRows,
      gradingQueue,
      pendingPurchases,
      mockGradingQueue,
      mockPendingPurchases,
      mockExams,
      paidSum,
      partialSum,
      paidCount,
      videos,
      tests,
    ] = await Promise.all([
      this.prisma.studentProfile.count({ where: { user: { isActive: true } } }),
      this.prisma.studentProfile.count({ where: { user: { isActive: true }, isApproved: true } }),
      this.prisma.user.count({ where: { role: 'teacher', isActive: true } }),
      this.prisma.user.count({ where: { role: 'parent', isActive: true } }),
      this.prisma.group.count(),
      this.prisma.attendance.findMany({ where: { date: today }, select: { state: true } }),
      this.prisma.testAttempt.count({ where: { status: 'grading' } }),
      this.prisma.videoPurchase.count({ where: { status: 'pending_confirmation' } }),
      this.prisma.mockAttempt.count({ where: { status: 'grading' } }),
      this.prisma.mockPurchase.count({ where: { status: 'pending_confirmation' } }),
      this.prisma.mockExam.count({ where: { isPublished: true } }),
      this.prisma.payment.aggregate({ where: { year, month, state: 'paid' }, _sum: { amount: true } }),
      this.prisma.payment.aggregate({ where: { year, month, state: 'partial' }, _sum: { amount: true } }),
      this.prisma.payment.count({ where: { year, month, state: 'paid' } }),
      this.prisma.videoLesson.count(),
      this.prisma.test.count({ where: { isActive: true } }),
    ]);

    // Qarzdorlar: guruhi bor, faol o'quvchilardan shu oyda "paid" yozuvi bo'lmaganlar
    const debtors = await this.prisma.studentProfile.count({
      where: {
        user: { isActive: true },
        groupId: { not: null },
        NOT: { payments: { some: { year, month, state: 'paid' } } },
      },
    });

    const present = todayRows.filter((r) => r.state === 'present').length;
    const absent = todayRows.filter((r) => r.state === 'absent').length;
    const late = todayRows.filter((r) => r.state === 'late').length;
    const marked = todayRows.length;

    return {
      students,
      approvedStudents,
      teachers,
      parents,
      groups,
      tests,
      videos,
      mock: {
        exams: mockExams,
        gradingQueue: mockGradingQueue,
        pendingPurchases: mockPendingPurchases,
      },
      today: {
        date: today.toISOString().slice(0, 10),
        marked,
        present,
        absent,
        late,
        attendanceRate: marked > 0 ? Math.round(((present + late) / marked) * 100) : null,
      },
      month: {
        month,
        year,
        income: (paidSum._sum.amount ?? 0) + (partialSum._sum.amount ?? 0),
        paidCount,
        debtors,
      },
      queue: {
        grading: gradingQueue,
        pendingPurchases,
      },
    };
  }

  /** Oxirgi 6 oy uchun tushum grafigi */
  async income(months = 6) {
    const now = new Date();
    const out: { month: number; year: number; income: number; paidCount: number }[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = d.getMonth() + 1;
      const year = d.getFullYear();
      const rows = await this.prisma.payment.findMany({
        where: { year, month, state: { in: ['paid', 'partial'] } },
        select: { amount: true, state: true },
      });
      out.push({
        month,
        year,
        income: rows.reduce((s, r) => s + r.amount, 0),
        paidCount: rows.filter((r) => r.state === 'paid').length,
      });
    }
    return out;
  }
}
