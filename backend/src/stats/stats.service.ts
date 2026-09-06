import { Injectable } from '@nestjs/common';
import { todayDateOnly } from '../common/date.util';
import { PrismaService } from '../prisma/prisma.service';

export type ExamActivityRange = 'today' | '7d' | '30d' | '3m' | '6m' | 'year';

/** Admin panelining bosh sahifasi uchun umumiy ko'rsatkichlar */
@Injectable()
export class StatsService {  constructor(private readonly prisma: PrismaService) {}

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

  /**
   * Imtihon faolligi: davr kesimida boshlangan urinishlar (volume) va
   * yakunlanganlarning o'rtacha bali (rate). Hammasi TestAttempt jadvalidan —
   * hech qanday sintetik ma'lumot yo'q.
   */
  async examActivity(range: ExamActivityRange = '7d') {
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    // Mahalliy ISO (Z siz): frontend `new Date(key)` ni mahalliy vaqt deb o'qiydi,
    // shuning uchun kun/soat yorliqlari har qanday mijoz soat mintaqasida to'g'ri chiqadi.
    const pad = (n: number) => String(n).padStart(2, '0');
    const localKey = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

    // Bucket chegaralari (eski → yangi), har biri { start, end }.
    const buckets: { start: Date; end: Date }[] = [];
    if (range === 'today') {
      const day = startOfDay(now);
      for (let h = 0; h < 24; h++) {
        buckets.push({ start: new Date(day.getTime() + h * 3_600_000), end: new Date(day.getTime() + (h + 1) * 3_600_000) });
      }
    } else if (range === '7d' || range === '30d') {
      const days = range === '7d' ? 7 : 30;
      const first = startOfDay(new Date(now.getTime() - (days - 1) * 86_400_000));
      for (let i = 0; i < days; i++) {
        const s = new Date(first.getTime() + i * 86_400_000);
        buckets.push({ start: s, end: new Date(s.getTime() + 86_400_000) });
      }
    } else if (range === '3m' || range === '6m') {
      // Haftalik (dushanba boshlanishi), joriy hafta bilan tugaydi.
      const weeks = range === '3m' ? 13 : 26;
      const dow = (now.getDay() + 6) % 7; // 0 = dushanba
      const thisMonday = startOfDay(new Date(now.getTime() - dow * 86_400_000));
      for (let i = weeks - 1; i >= 0; i--) {
        const s = new Date(thisMonday.getTime() - i * 7 * 86_400_000);
        buckets.push({ start: s, end: new Date(s.getTime() + 7 * 86_400_000) });
      }
    } else {
      // year: yanvar → joriy oy (oylik).
      for (let m = 0; m <= now.getMonth(); m++) {
        buckets.push({ start: new Date(now.getFullYear(), m, 1), end: new Date(now.getFullYear(), m + 1, 1) });
      }
    }

    const from = buckets[0].start;
    const attempts = await this.prisma.testAttempt.findMany({
      where: { startedAt: { gte: from } },
      select: { startedAt: true, status: true, totalScore: true, autoScore: true },
    });

    const data = buckets.map((b) => {
      const inBucket = attempts.filter((a) => a.startedAt >= b.start && a.startedAt < b.end);
      const completed = inBucket.filter((a) => a.status === 'completed').length;
      const scores = inBucket
        .map((a) => a.totalScore ?? a.autoScore)
        .filter((s): s is number => typeof s === 'number' && Number.isFinite(s));
      return {
        key: localKey(b.start),
        started: inBucket.length,
        completed,
        avgScore: scores.length ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10 : null,
      };
    });

    const totalStarted = data.reduce((s, b) => s + b.started, 0);
    const totalCompleted = data.reduce((s, b) => s + b.completed, 0);
    const allScores = attempts
      .map((a) => a.totalScore ?? a.autoScore)
      .filter((s): s is number => typeof s === 'number' && Number.isFinite(s));

    return {
      range,
      buckets: data,
      totals: {
        started: totalStarted,
        completed: totalCompleted,
        avgScore: allScores.length
          ? Math.round((allScores.reduce((s, v) => s + v, 0) / allScores.length) * 10) / 10
          : null,
        completionRate:
          totalStarted > 0 ? Math.round((totalCompleted / totalStarted) * 1000) / 10 : 0,
      },
    };
  }
}
