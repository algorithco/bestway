import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramLinkService } from './telegram-link.service';
import { TelegramMenuService } from './telegram-menu.service';
import { TelegramService, TgUpdate } from './telegram.service';

const line = '➖➖➖➖➖➖➖➖➖';

const welcome = (center: string) =>
  `🎓 <b>${center}</b>\n${line}\n\n` +
  `Assalomu alaykum! Bu — markazning rasmiy xabarchi boti.\n\n` +
  `Bu yerga quyidagilar keladi:\n` +
  `   🏆 ball o'zgarishlari\n` +
  `   📅 davomat xabarlari\n` +
  `   💰 to'lov eslatmalari\n` +
  `   📝 test natijalari\n\n` +
  `<b>Akkauntingizni bog'lang:</b>\n` +
  `1️⃣ Saytga kiring → profil → <b>"Telegramni ulash"</b>\n` +
  `2️⃣ Yoki pastdagi tugma bilan telefon raqamingizni yuboring 👇`;

const HELP = `ℹ️ <b>Buyruqlar</b>\n${line}\n\n/start — akkauntni bog'lash\n/menu — menyuni ko'rsatish\n/status — bog'lanish holati\n/unlink — akkauntni uzish\n/help — shu yordam`;

/**
 * Botning "quloqlari": Telegramdan keladigan xabarlarni qabul qiladi.
 *
 * Ikki rejim (TELEGRAM_MODE):
 *  - polling (standart) — domen/HTTPS shart emas, dev va oddiy serverlar uchun
 *  - webhook           — prodakshan uchun; TELEGRAM_WEBHOOK_URL + TELEGRAM_WEBHOOK_SECRET kerak
 */
@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private polling = false;
  private offset = 0;

  constructor(
    private readonly telegram: TelegramService,
    private readonly links: TelegramLinkService,
    private readonly menu: TelegramMenuService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get centerName(): string {
    return this.config.get<string>('CENTER_NAME') ?? "O'quv markaz";
  }

  private get mode(): 'off' | 'polling' | 'webhook' {
    if (!this.telegram.enabled) return 'off';
    const m = (this.config.get<string>('TELEGRAM_MODE') ?? 'polling').toLowerCase();
    return m === 'webhook' ? 'webhook' : m === 'off' ? 'off' : 'polling';
  }

  get webhookSecret(): string {
    return this.config.get<string>('TELEGRAM_WEBHOOK_SECRET') ?? '';
  }

  async onModuleInit(): Promise<void> {
    const mode = this.mode;
    if (mode === 'off') {
      this.logger.log("Telegram bot o'chiq (TELEGRAM_BOT_TOKEN yo'q yoki TELEGRAM_MODE=off)");
      return;
    }

    await this.telegram.setMyCommands();

    if (mode === 'webhook') {
      const url = this.config.get<string>('TELEGRAM_WEBHOOK_URL');
      if (!url) {
        this.logger.warn("TELEGRAM_MODE=webhook, lekin TELEGRAM_WEBHOOK_URL berilmagan — webhook ro'yxatdan o'tkazilmadi");
        return;
      }
      if (!this.webhookSecret) {
        this.logger.error("TELEGRAM_WEBHOOK_SECRET majburiy — webhook ro'yxatdan o'tkazilmadi");
        return;
      }
      const ok = await this.telegram.setWebhook(url, this.webhookSecret);
      this.logger.log(ok ? `Telegram webhook o'rnatildi: ${url}` : "Webhook o'rnatilmadi");
      return;
    }

    // polling: avval webhookni olib tashlaymiz (ikkalasi birga ishlamaydi)
    await this.telegram.deleteWebhook();
    this.polling = true;
    void this.pollLoop();
    this.logger.log('Telegram bot long-polling rejimida ishga tushdi');
  }

  onModuleDestroy(): void {
    this.polling = false;
  }

  private async pollLoop(): Promise<void> {
    while (this.polling) {
      try {
        const updates = await this.telegram.getUpdates(this.offset, 30);
        for (const u of updates) {
          this.offset = u.update_id + 1;
          await this.handleUpdate(u);
        }
      } catch (e) {
        this.logger.warn(`Polling xatosi: ${String(e)}`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  /** Webhook va polling — ikkalasi ham shu yerga keladi */
  async handleUpdate(update: TgUpdate): Promise<void> {
    const msg = update.message;
    if (!msg) return;
    const chatId = msg.chat.id;

    try {
      // 1) Kontakt ulashildi (zaxira bog'lash yo'li)
      if (msg.contact) {
        const ownContact = msg.contact.user_id !== undefined && msg.contact.user_id === msg.from?.id;
        await this.links.linkByContact(msg.contact.phone_number, chatId, ownContact);
        await this.showMenuIfLinked(chatId);
        return;
      }

      const text = (msg.text ?? '').trim();
      if (!text) return;

      // 2) /start [token] — asosiy bog'lash yo'li
      if (text.startsWith('/start')) {
        const payload = text.slice('/start'.length).trim();
        if (payload) {
          await this.links.consumeToken(payload, chatId);
          await this.showMenuIfLinked(chatId);
          return;
        }
        // Tokensiz /start: allaqachon bog'langan bo'lsa — menyu, aks holda taklif
        if (await this.showMenuIfLinked(chatId)) return;
        await this.telegram.sendWithContactRequest(chatId, welcome(this.centerName));
        return;
      }

      if (text.startsWith('/menu')) {
        if (!(await this.showMenuIfLinked(chatId))) {
          await this.telegram.sendWithContactRequest(chatId, welcome(this.centerName));
        }
        return;
      }

      if (text.startsWith('/unlink') || text.startsWith('/stop')) {
        await this.links.unlinkByChat(chatId);
        return;
      }

      if (text.startsWith('/status')) {
        await this.sendStatus(chatId);
        return;
      }

      if (text.startsWith('/help')) {
        await this.telegram.send(chatId, HELP);
        return;
      }

      // 3) Menyu tugmalari
      if (await this.menu.handleButton(chatId, text)) return;

      // 4) Tushunarsiz xabar
      if (await this.showMenuIfLinked(chatId)) return;
      await this.telegram.sendWithContactRequest(chatId, welcome(this.centerName));
    } catch (e) {
      this.logger.error(`Update ishlanmadi (chat ${chatId}): ${String(e)}`);
    }
  }

  /** Bog'langan bo'lsa rolga mos menyuni ko'rsatadi */
  private async showMenuIfLinked(chatId: number): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { telegramChatId: String(chatId), isActive: true },
      select: { name: true, role: true },
    });
    if (!user) return false;
    await this.menu.showMenu(chatId, user.role, user.name);
    return true;
  }

  private async sendStatus(chatId: number): Promise<void> {
    const linked = await this.links.findUserByChat(chatId);
    await this.telegram.send(
      chatId,
      linked
        ? `✅ <b>Bog'langan</b>\n${line}\n\nAkkaunt: <b>${linked.name}</b>\n\nUzish uchun: /unlink`
        : `❌ <b>Bog'lanmagan</b>\n${line}\n\nSaytdagi "Telegramni ulash" tugmasidan foydalaning yoki /start bosing.`,
    );
  }
}
