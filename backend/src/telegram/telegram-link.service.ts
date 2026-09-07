import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/app.exception';
import { AuthUser } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { escapeTelegramHtml, TelegramService } from './telegram.service';

/** Telefon raqamdan faqat oxirgi 9 raqam (Uzbekistonda shu qism unikal) */
function phoneKey(phone: string): string {
  return phone.replace(/\D/g, '').slice(-9);
}

@Injectable()
export class TelegramLinkService {
  private readonly logger = new Logger(TelegramLinkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private get ttlMinutes(): number {
    return parseInt(this.config.get<string>('TELEGRAM_LINK_TTL_MINUTES') ?? '10', 10);
  }

  /**
   * Sayt "Telegramni ulash" tugmasi uchun.
   * Token login qilingan sessiyadan chiqadi — demak uni faqat haqiqiy egasi ola oladi.
   */
  async createLinkToken(user: AuthUser): Promise<{ url: string; token: string; expiresAt: Date }> {
    if (!this.telegram.enabled) {
      throw new AppException('TELEGRAM_DISABLED', 'Telegram bot sozlanmagan', 400);
    }
    const username = await this.telegram.getBotUsername();
    if (!username) {
      throw new AppException('TELEGRAM_DISABLED', 'Bot username aniqlanmadi', 400);
    }

    // Eski/ishlatilgan tokenlarni tozalab turamiz
    await this.prisma.telegramLinkToken.deleteMany({
      where: { OR: [{ userId: user.id }, { expiresAt: { lt: new Date() } }] },
    });

    const token = randomBytes(24).toString('base64url'); // 32 belgi, deep-link limitiga sig'adi
    const expiresAt = new Date(Date.now() + this.ttlMinutes * 60_000);
    await this.prisma.telegramLinkToken.create({
      data: { userId: user.id, tokenHash: this.hash(token), expiresAt },
    });

    return { url: `https://t.me/${username}?start=${token}`, token, expiresAt };
  }

  async status(userId: string): Promise<{ linked: boolean; botUsername: string | null }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { telegramChatId: true },
    });
    return {
      linked: Boolean(user?.telegramChatId),
      botUsername: this.telegram.enabled ? await this.telegram.getBotUsername() : null,
    };
  }

  /** Saytdan uzish */
  async unlink(user: AuthUser): Promise<{ unlinked: boolean }> {
    const current = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { telegramChatId: true },
    });
    if (!current?.telegramChatId) return { unlinked: false };

    await this.prisma.user.update({ where: { id: user.id }, data: { telegramChatId: null } });
    await this.telegram.sendPlain(
      current.telegramChatId,
      "🔌 Telegram akkauntingiz saytdan uzildi. Xabarlar endi bu yerga kelmaydi.",
    );
    await this.audit.log({
      userId: user.id,
      action: 'user.telegram_unlink',
      entity: 'user',
      entityId: user.id,
    });
    return { unlinked: true };
  }

  /**
   * Bot "/start <token>" ni qabul qildi.
   * chat.id ni Telegramning o'zi beradi — soxtalashtirib bo'lmaydi;
   * token esa kim ekanini isbotlaydi. Ikkovi birga — ishonchli bog'lanish.
   */
  async consumeToken(token: string, chatId: number): Promise<void> {
    const row = await this.prisma.telegramLinkToken.findUnique({
      where: { tokenHash: this.hash(token) },
      include: { user: { select: { id: true, name: true, isActive: true } } },
    });

    if (!row || row.usedAt || row.expiresAt < new Date()) {
      await this.telegram.sendPlain(
        chatId,
        "❌ Bog'lash havolasi eskirgan yoki ishlatilgan.\nSaytga kiring va \"Telegramni ulash\" tugmasini qaytadan bosing.",
      );
      return;
    }
    if (!row.user.isActive) {
      await this.telegram.sendPlain(chatId, '❌ Akkaunt bloklangan. Administratsiyaga murojaat qiling.');
      return;
    }

    await this.attach(row.user.id, chatId);
    await this.prisma.telegramLinkToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });

    await this.telegram.sendPlain(
      chatId,
      `✅ <b>Bog'landi!</b>\n\nAkkaunt: <b>${escapeTelegramHtml(row.user.name)}</b>\n\n` +
        `Endi ball, davomat, to'lov va test natijalari haqidagi xabarlar shu yerga keladi.`,
    );
    await this.audit.log({
      userId: row.user.id,
      action: 'user.telegram_link',
      entity: 'user',
      entityId: row.user.id,
      newValue: { method: 'deep_link' },
    });
  }

  /**
   * Zaxira yo'l: foydalanuvchi botga o'z kontaktini yuboradi.
   * Telegram faqat O'Z kontaktini ulashishga ruxsat beradi (contact.user_id === from.id),
   * shuning uchun raqam egasi ekani isbotlangan hisoblanadi.
   */
  async linkByContact(phone: string, chatId: number, ownContact: boolean): Promise<void> {
    if (!ownContact) {
      await this.telegram.sendPlain(chatId, "❌ Iltimos, faqat o'zingizning raqamingizni yuboring.");
      return;
    }

    const key = phoneKey(phone);
    if (key.length < 9) {
      await this.telegram.sendPlain(chatId, "❌ Raqam formati noto'g'ri.");
      return;
    }

    const matches = await this.prisma.user.findMany({
      where: { phone: { endsWith: key }, isActive: true },
      select: { id: true, name: true },
    });

    if (matches.length === 0) {
      await this.telegram.sendPlain(
        chatId,
        "❌ Bu raqam tizimda topilmadi.\nAdministratsiyaga murojaat qiling yoki saytga kirib \"Telegramni ulash\" tugmasidan foydalaning.",
      );
      return;
    }
    if (matches.length > 1) {
      await this.telegram.sendPlain(
        chatId,
        "⚠️ Bu raqam bir nechta akkauntga tegishli. Saytga kirib \"Telegramni ulash\" tugmasidan foydalaning.",
      );
      return;
    }

    await this.attach(matches[0].id, chatId);
    await this.telegram.sendPlain(
      chatId,
      `✅ <b>Bog'landi!</b>\n\nAkkaunt: <b>${escapeTelegramHtml(matches[0].name)}</b>\n\nEndi xabarlar shu yerga keladi.`,
    );
    await this.audit.log({
      userId: matches[0].id,
      action: 'user.telegram_link',
      entity: 'user',
      entityId: matches[0].id,
      newValue: { method: 'contact' },
    });
  }

  /** Bot /status buyrug'i uchun */
  async findUserByChat(chatId: number): Promise<{ id: string; name: string } | null> {
    return this.prisma.user.findFirst({
      where: { telegramChatId: String(chatId) },
      select: { id: true, name: true },
    });
  }

  /** Bot ichidan uzish (/unlink) */
  async unlinkByChat(chatId: number): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { telegramChatId: String(chatId) },
      select: { id: true },
    });
    if (!user) {
      await this.telegram.sendPlain(chatId, "ℹ️ Bu chat hech qanday akkauntga bog'lanmagan.");
      return;
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { telegramChatId: null } });
    await this.telegram.sendPlain(chatId, "🔌 Uzildi. Qayta ulash uchun saytdagi tugmadan foydalaning.");
    await this.audit.log({
      userId: user.id,
      action: 'user.telegram_unlink',
      entity: 'user',
      entityId: user.id,
    });
  }

  /** Bitta chat — bitta foydalanuvchi: eski egasidan uzib, yangisiga biriktiramiz */
  private async attach(userId: string, chatId: number): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.updateMany({
        where: { telegramChatId: String(chatId), id: { not: userId } },
        data: { telegramChatId: null },
      }),
      this.prisma.user.update({ where: { id: userId }, data: { telegramChatId: String(chatId) } }),
    ]);
  }
}
