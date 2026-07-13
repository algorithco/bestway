import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Telegram yuboradigan update (bizga kerakli qismi) */
export interface TgUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name?: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
    contact?: { phone_number: string; user_id?: number; first_name?: string };
  };
}

/** "Raqamni yuborish" tugmasi — bir marta bosiladi va yo'qoladi */
const CONTACT_KEYBOARD = {
  keyboard: [[{ text: "📱 Telefon raqamimni yuborish", request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
};

/**
 * Telegram Bot API bilan ishlash (xabar yuborish + update olish).
 * TELEGRAM_BOT_TOKEN berilmagan bo'lsa jimgina o'chiq turadi —
 * in-app bildirishnomalar baribir ishlayveradi.
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private cachedUsername: string | null = null;

  constructor(private readonly config: ConfigService) {}

  get token(): string {
    return this.config.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
  }

  get enabled(): boolean {
    return this.token.length > 0;
  }

  /** Bot API chaqiruvi — xatolik hech qachon asosiy oqimni buzmaydi */
  private async call<T>(method: string, payload?: unknown): Promise<T | null> {
    if (!this.enabled) return null;
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload ?? {}),
      });
      const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
      if (!json.ok) {
        this.logger.warn(`Telegram ${method}: ${json.description ?? 'noma\'lum xatolik'}`);
        return null;
      }
      return json.result ?? null;
    } catch (e) {
      this.logger.warn(`Telegram ${method} chaqiruvi muvaffaqiyatsiz: ${String(e)}`);
      return null;
    }
  }

  async send(chatId: string | number, text: string): Promise<void> {
    if (!chatId) return;
    await this.call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML' });
  }

  /** Raqam so'rash tugmasi bilan xabar */
  async sendWithContactRequest(chatId: string | number, text: string): Promise<void> {
    await this.call('sendMessage', { chat_id: chatId, text, reply_markup: CONTACT_KEYBOARD });
  }

  /** Klaviaturani olib tashlash */
  async sendPlain(chatId: string | number, text: string): Promise<void> {
    await this.call('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: { remove_keyboard: true },
    });
  }

  /** Doimiy menyu klaviaturasi bilan xabar */
  async sendMenu(chatId: string | number, text: string, keyboard: unknown): Promise<void> {
    await this.call('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  }

  /** Long polling: server 30 soniyagacha yangi update kutib turadi */
  async getUpdates(offset: number, timeoutSeconds = 30): Promise<TgUpdate[]> {
    const res = await this.call<TgUpdate[]>('getUpdates', {
      offset,
      timeout: timeoutSeconds,
      allowed_updates: ['message'],
    });
    return res ?? [];
  }

  /** Telegramdagi "Menu" tugmasida chiqadigan buyruqlar ro'yxati */
  async setMyCommands(): Promise<void> {
    await this.call('setMyCommands', {
      commands: [
        { command: 'start', description: "Akkauntni bog'lash" },
        { command: 'status', description: "Bog'lanish holati" },
        { command: 'unlink', description: 'Akkauntni uzish' },
        { command: 'help', description: 'Yordam' },
      ],
    });
  }

  async setWebhook(url: string, secret: string): Promise<boolean> {
    const res = await this.call<boolean>('setWebhook', {
      url,
      secret_token: secret,
      allowed_updates: ['message'],
      drop_pending_updates: true,
    });
    return res === true;
  }

  async deleteWebhook(): Promise<void> {
    await this.call('deleteWebhook', { drop_pending_updates: false });
  }

  /**
   * Deep link uchun bot username.
   * TELEGRAM_BOT_USERNAME berilmasa — getMe orqali bir marta olinadi va keshlanadi.
   */
  async getBotUsername(): Promise<string | null> {
    const fromEnv = this.config.get<string>('TELEGRAM_BOT_USERNAME');
    if (fromEnv) return fromEnv.replace('@', '');
    if (this.cachedUsername) return this.cachedUsername;
    const me = await this.call<{ username?: string }>('getMe');
    this.cachedUsername = me?.username ?? null;
    return this.cachedUsername;
  }
}
