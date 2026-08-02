import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { monthRangeUtc, todayDateOnly } from '../common/date.util';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from './telegram.service';

const UZ_MONTHS = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
];

/** Menyu tugmalari (reply keyboard matnlari) */
export const BTN = {
  points: '🏆 Ballarim',
  attendance: '📅 Davomatim',
  payment: "💰 To'lovlarim",
  results: '📝 Natijalarim',
  children: '👨‍👩‍👦 Farzandlarim',
  groups: '👥 Guruhlarim',
  grading: '✍️ Baholash navbati',
  today: '📊 Bugungi holat',
  debtors: '💸 Qarzdorlar',
  help: 'ℹ️ Yordam',
};

const STATE_LABEL: Record<string, string> = {
  present: '✅ Keldi',
  absent: '❌ Kelmadi',
  late: '⏰ Kechikdi',
  paid: "✅ To'langan",
  unpaid: "❌ To'lanmagan",
  partial: "🟡 Qisman to'langan",
  in_progress: '⏳ Topshirilmoqda',
  grading: '✍️ Baholanmoqda',
  completed: '✅ Tayyor',
};

const label = (v: string): string => STATE_LABEL[v] ?? v;
const money = (n: number): string => n.toLocaleString('uz-UZ') + " so'm";
const dateUz = (d: Date): string => `${d.getDate()}-${UZ_MONTHS[d.getMonth()]}`;

/** Rolga qarab doimiy klaviatura */
export function menuFor(role: Role): { keyboard: { text: string }[][]; resize_keyboard: true } {
  const rows: string[][] =
    role === 'student'
      ? [[BTN.points, BTN.attendance], [BTN.payment, BTN.results], [BTN.help]]
      : role === 'parent'
        ? [[BTN.children], [BTN.attendance, BTN.payment], [BTN.points, BTN.results], [BTN.help]]
        : role === 'teacher'
          ? [[BTN.groups, BTN.grading], [BTN.help]]
          : [[BTN.today, BTN.debtors], [BTN.help]];

  return {
    keyboard: rows.map((r) => r.map((text) => ({ text }))),
    resize_keyboard: true,
  };
}

/**
 * Bot menyusi: foydalanuvchi tugma bosganda kerakli ma'lumotni bazadan olib,
 * chiroyli formatlangan xabar qaytaradi. Ota-ona farzandi ma'lumotini ko'radi.
 */
@Injectable()
export class TelegramMenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
  ) {}

  /** Menyuni ko'rsatish (bog'langandan keyin va /menu da) */
  async showMenu(chatId: number, role: Role, name: string): Promise<void> {
    await this.telegram.sendMenu(
      chatId,
      `👋 Xush kelibsiz, <b>${name}</b>!\n\nQuyidagi tugmalardan foydalaning:`,
      menuFor(role),
    );
  }

  /** Tugma bosildi — matn bo'yicha javob beramiz. true = tugma tanildi */
  async handleButton(chatId: number, text: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { telegramChatId: String(chatId), isActive: true },
      select: { id: true, name: true, role: true },
    });
    if (!user) return false;

    switch (text) {
      case BTN.points:
        await this.send(chatId, await this.pointsText(user.id, user.role));
        return true;
      case BTN.attendance:
        await this.send(chatId, await this.attendanceText(user.id, user.role));
        return true;
      case BTN.payment:
        await this.send(chatId, await this.paymentsText(user.id, user.role));
        return true;
      case BTN.results:
        await this.send(chatId, await this.resultsText(user.id, user.role));
        return true;
      case BTN.children:
        await this.send(chatId, await this.childrenText(user.id));
        return true;
      case BTN.groups:
        await this.send(chatId, await this.groupsText(user.id));
        return true;
      case BTN.grading:
        await this.send(chatId, await this.gradingText(user.id));
        return true;
      case BTN.today:
        await this.send(chatId, await this.todayText());
        return true;
      case BTN.debtors:
        await this.send(chatId, await this.debtorsText());
        return true;
      case BTN.help:
        await this.send(chatId, this.helpText(user.role));
        return true;
      default:
        return false;
    }
  }

  private async send(chatId: number, text: string): Promise<void> {
    await this.telegram.send(chatId, text);
  }

  /** Ota-ona uchun: farzandlari; o'quvchi uchun: o'zi */
  private async targets(userId: string, role: Role): Promise<{ id: string; name: string }[]> {
    if (role === 'student') {
      const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
      return u ? [u] : [];
    }
    if (role === 'parent') {
      const links = await this.prisma.parentStudent.findMany({
        where: { parentUserId: userId },
        include: { student: { include: { user: { select: { id: true, name: true } } } } },
      });
      return links.map((l) => ({ id: l.studentId, name: l.student.user.name }));
    }
    return [];
  }

  private noChildren(role: Role): string {
    return role === 'parent'
      ? "👨‍👩‍👦 Sizga hali farzand bog'lanmagan.\n\nSaytga kiring → <b>Farzandni ulash</b> → o'quvchining 8 belgili kodini kiriting."
      : "ℹ️ Bu bo'lim faqat o'quvchi va ota-onalar uchun.";
  }

  // ---------------- Ballar ----------------
  private async pointsText(userId: string, role: Role): Promise<string> {
    const kids = await this.targets(userId, role);
    if (kids.length === 0) return this.noChildren(role);

    const parts: string[] = [];
    for (const kid of kids) {
      const profile = await this.prisma.studentProfile.findUnique({ where: { userId: kid.id } });
      if (!profile) continue;
      const logs = await this.prisma.pointsLog.findMany({
        where: { studentId: kid.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
      const history = logs
        .map((l) => `   ${l.change > 0 ? '➕' : '➖'} ${Math.abs(l.change)} — ${l.reason} <i>(${dateUz(l.createdAt)})</i>`)
        .join('\n');
      parts.push(
        `🏆 <b>${kid.name}</b>\nJoriy ball: <b>${profile.currentPoints}</b>\n\n<u>Oxirgi o'zgarishlar:</u>\n${history || '   — hali yozuv yo\'q'}`,
      );
    }
    return parts.join('\n\n➖➖➖➖➖\n\n');
  }

  // ---------------- Davomat ----------------
  private async attendanceText(userId: string, role: Role): Promise<string> {
    const kids = await this.targets(userId, role);
    if (kids.length === 0) return this.noChildren(role);

    const now = new Date();
    const { gte, lt } = monthRangeUtc();
    const parts: string[] = [];

    for (const kid of kids) {
      const rows = await this.prisma.attendance.findMany({
        where: { studentId: kid.id, date: { gte, lt } },
        orderBy: { date: 'desc' },
      });
      const present = rows.filter((r) => r.state === 'present').length;
      const absent = rows.filter((r) => r.state === 'absent').length;
      const late = rows.filter((r) => r.state === 'late').length;
      const last = rows
        .slice(0, 7)
        .map((r) => `   ${dateUz(r.date)} — ${label(r.state)}`)
        .join('\n');

      parts.push(
        `📅 <b>${kid.name}</b> — ${UZ_MONTHS[now.getMonth()]} oyi\n` +
          `✅ Keldi: <b>${present}</b>   ❌ Kelmadi: <b>${absent}</b>   ⏰ Kechikdi: <b>${late}</b>\n\n` +
          `<u>Oxirgi darslar:</u>\n${last || '   — yozuv yo\'q'}`,
      );
    }
    return parts.join('\n\n➖➖➖➖➖\n\n');
  }

  // ---------------- To'lovlar ----------------
  private async paymentsText(userId: string, role: Role): Promise<string> {
    const kids = await this.targets(userId, role);
    if (kids.length === 0) return this.noChildren(role);

    const year = new Date().getFullYear();
    const parts: string[] = [];
    for (const kid of kids) {
      const rows = await this.prisma.payment.findMany({
        where: { studentId: kid.id, year },
        orderBy: { month: 'asc' },
      });
      const list = rows
        .map((p) => `   ${UZ_MONTHS[p.month - 1]}: ${label(p.state)}${p.amount ? ` — ${money(p.amount)}` : ''}`)
        .join('\n');
      const debt = rows.filter((p) => p.state !== 'paid').length;

      parts.push(
        `💰 <b>${kid.name}</b> — ${year}-yil\n\n${list || "   — to'lov yozuvi yo'q"}\n\n` +
          (debt > 0
            ? `⚠️ To'lanmagan oylar: <b>${debt}</b> ta.\nSavollar bo'lsa administratsiyaga murojaat qiling.`
            : '✅ Barcha to\'lovlar joyida. Rahmat!'),
      );
    }
    return parts.join('\n\n➖➖➖➖➖\n\n');
  }

  // ---------------- Test natijalari ----------------
  private async resultsText(userId: string, role: Role): Promise<string> {
    const kids = await this.targets(userId, role);
    if (kids.length === 0) return this.noChildren(role);

    const parts: string[] = [];
    for (const kid of kids) {
      const attempts = await this.prisma.testAttempt.findMany({
        where: { studentId: kid.id },
        include: { test: { select: { title: true } } },
        orderBy: { startedAt: 'desc' },
        take: 5,
      });
      const list = attempts
        .map((a) => {
          const score = a.status === 'completed' ? ` — <b>${a.totalScore}</b> ball` : '';
          return `   ${a.test.title}\n      ${label(a.status)}${score} <i>(${dateUz(a.startedAt)})</i>`;
        })
        .join('\n');
      parts.push(`📝 <b>${kid.name}</b> — oxirgi testlar\n\n${list || '   — hali test topshirilmagan'}`);
    }
    return parts.join('\n\n➖➖➖➖➖\n\n');
  }

  // ---------------- Ota-ona: farzandlar ----------------
  private async childrenText(userId: string): Promise<string> {
    const links = await this.prisma.parentStudent.findMany({
      where: { parentUserId: userId },
      include: {
        student: {
          include: { user: { select: { name: true } }, group: { select: { name: true } } },
        },
      },
    });
    if (links.length === 0) return this.noChildren('parent');

    const now = new Date();
    const { gte } = monthRangeUtc();
    const parts: string[] = [];

    for (const l of links) {
      const s = l.student;
      const absent = await this.prisma.attendance.count({
        where: { studentId: l.studentId, state: 'absent', date: { gte } },
      });
      const unpaid = await this.prisma.payment.count({
        where: { studentId: l.studentId, year: now.getFullYear(), state: { not: 'paid' } },
      });
      parts.push(
        `👤 <b>${s.user.name}</b>\n` +
          `   Guruh: ${s.group?.name ?? "— (guruhga biriktirilmagan)"}\n` +
          `   Ball: <b>${s.currentPoints}</b>\n` +
          `   Bu oy kelmagan kunlar: <b>${absent}</b>\n` +
          `   To'lanmagan oylar: <b>${unpaid}</b>`,
      );
    }
    return `👨‍👩‍👦 <b>Farzandlaringiz</b>\n\n${parts.join('\n\n')}\n\n<i>Batafsil: pastdagi tugmalar.</i>`;
  }

  // ---------------- O'qituvchi ----------------
  private async groupsText(userId: string): Promise<string> {
    const groups = await this.prisma.group.findMany({
      where: { teacherId: userId },
      include: { _count: { select: { students: true } } },
    });
    if (groups.length === 0) return "👥 Sizga hali guruh biriktirilmagan.";

    const today = todayDateOnly();
    const parts: string[] = [];
    for (const g of groups) {
      const marked = await this.prisma.attendance.count({ where: { groupId: g.id, date: today } });
      parts.push(
        `👥 <b>${g.name}</b>\n   O'quvchilar: <b>${g._count.students}</b>\n   Bugungi davomat: ${
          marked > 0 ? `✅ belgilangan (${marked})` : '⚠️ hali belgilanmagan'
        }`,
      );
    }
    return parts.join('\n\n');
  }

  private async gradingText(userId: string): Promise<string> {
    const attempts = await this.prisma.testAttempt.findMany({
      where: { status: 'grading', student: { group: { teacherId: userId } } },
      include: {
        student: { include: { user: { select: { name: true } } } },
        test: { select: { title: true } },
      },
      orderBy: { finishedAt: 'asc' },
      take: 10,
    });
    if (attempts.length === 0) return '✍️ Baholash navbati bo\'sh. Barakalla! 🎉';

    const list = attempts
      .map((a) => `   • ${a.student.user.name} — ${a.test.title}`)
      .join('\n');
    return `✍️ <b>Baholash kutilmoqda: ${attempts.length} ta</b>\n\n${list}\n\n<i>Baholash saytdagi panelda amalga oshiriladi.</i>`;
  }

  // ---------------- Admin ----------------
  private async todayText(): Promise<string> {
    const today = todayDateOnly();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const [students, groups, todayRows, grading, paidThisMonth] = await Promise.all([
      this.prisma.studentProfile.count({ where: { user: { isActive: true } } }),
      this.prisma.group.count(),
      this.prisma.attendance.findMany({ where: { date: today }, select: { state: true } }),
      this.prisma.testAttempt.count({ where: { status: 'grading' } }),
      this.prisma.payment.aggregate({ where: { year, month, state: 'paid' }, _sum: { amount: true } }),
    ]);

    const present = todayRows.filter((r) => r.state === 'present').length;
    const absent = todayRows.filter((r) => r.state === 'absent').length;
    const late = todayRows.filter((r) => r.state === 'late').length;

    const debtors = await this.prisma.studentProfile.count({
      where: {
        user: { isActive: true },
        groupId: { not: null },
        NOT: { payments: { some: { year, month, state: 'paid' } } },
      },
    });

    return (
      `📊 <b>Bugungi holat</b> — ${dateUz(today)}\n\n` +
      `👨‍🎓 O'quvchilar: <b>${students}</b>\n` +
      `👥 Guruhlar: <b>${groups}</b>\n\n` +
      `<u>Bugungi davomat:</u>\n` +
      `   ✅ Keldi: <b>${present}</b>\n   ❌ Kelmadi: <b>${absent}</b>\n   ⏰ Kechikdi: <b>${late}</b>\n` +
      (todayRows.length === 0 ? '   <i>hali belgilanmagan</i>\n' : '') +
      `\n💰 Bu oy tushum: <b>${money(paidThisMonth._sum.amount ?? 0)}</b>\n` +
      `💸 Qarzdorlar: <b>${debtors}</b>\n` +
      `✍️ Baholanmagan testlar: <b>${grading}</b>`
    );
  }

  private async debtorsText(): Promise<string> {
    const now = new Date();
    const students = await this.prisma.studentProfile.findMany({
      where: { user: { isActive: true }, groupId: { not: null } },
      include: {
        user: { select: { name: true, phone: true } },
        payments: { where: { year: now.getFullYear(), month: now.getMonth() + 1 } },
      },
    });
    const debtors = students.filter((s) => s.payments[0]?.state !== 'paid');
    if (debtors.length === 0) return `✅ ${UZ_MONTHS[now.getMonth()]} oyida qarzdor yo'q. Ajoyib!`;

    const list = debtors
      .slice(0, 20)
      .map((s) => `   • ${s.user.name} — ${s.user.phone} ${label(s.payments[0]?.state ?? 'unpaid')}`)
      .join('\n');
    const more = debtors.length > 20 ? `\n\n<i>…va yana ${debtors.length - 20} ta</i>` : '';

    return (
      `💸 <b>Qarzdorlar — ${UZ_MONTHS[now.getMonth()]}</b> (${debtors.length} ta)\n\n${list}${more}\n\n` +
      `<i>Eslatma yuborish: admin panel → To'lovlar → "Eslatma yuborish".</i>`
    );
  }

  private helpText(role: Role): string {
    const common =
      `ℹ️ <b>Yordam</b>\n\n` +
      `Bu bot orqali markaz yangiliklari va shaxsiy xabarlar keladi.\n\n` +
      `<u>Buyruqlar:</u>\n/menu — menyuni ko'rsatish\n/status — bog'lanish holati\n/unlink — akkauntni uzish\n\n`;

    const perRole: Record<string, string> = {
      student: "Tugmalar orqali ballaringiz, davomatingiz, to'lovlaringiz va test natijalaringizni ko'rasiz.",
      parent: "Tugmalar orqali farzandingiz ballari, davomati, to'lovlari va test natijalarini kuzatasiz.",
      teacher: "Guruhlaringiz va baholash navbatini ko'rasiz. Baholash saytdagi panelda bajariladi.",
      admin: "Markazning bugungi holati va qarzdorlar ro'yxatini ko'rasiz. To'liq boshqaruv — admin panelda.",
      super_admin: 'Markazning bugungi holati va qarzdorlar. To\'liq boshqaruv — admin panelda.',
    };

    return common + (perRole[role] ?? '') + `\n\nSavollar bo'lsa administratsiyaga murojaat qiling.`;
  }
}
