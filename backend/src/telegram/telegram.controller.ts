import { Body, Controller, Delete, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { timingSafeEqual } from 'crypto';
import { AppException } from '../common/app.exception';
import { CurrentUser, Public } from '../common/decorators';
import { AuthUser } from '../common/types';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramLinkService } from './telegram-link.service';
import { TgUpdate } from './telegram.service';

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

@ApiTags('telegram')
@Controller('telegram')
export class TelegramController {
  constructor(
    private readonly links: TelegramLinkService,
    private readonly bot: TelegramBotService,
  ) {}

  /** Bog'lanish holati (profil sahifasi uchun) */
  @ApiBearerAuth()
  @Get('status')
  status(@CurrentUser() user: AuthUser) {
    return this.links.status(user.id);
  }

  /**
   * "Telegramni ulash" tugmasi.
   * Qaytgan url'ni tugmaga qo'ying yoki QR qilib chizing.
   */
  @ApiBearerAuth()
  @Post('link-token')
  @HttpCode(200)
  linkToken(@CurrentUser() user: AuthUser) {
    return this.links.createLinkToken(user);
  }

  /** Telegramni uzish */
  @ApiBearerAuth()
  @Delete('link')
  unlink(@CurrentUser() user: AuthUser) {
    return this.links.unlink(user);
  }

  /**
   * Telegram serveri chaqiradigan endpoint (TELEGRAM_MODE=webhook).
   * Himoya: setWebhook da berilgan secret_token har so'rovda header'da qaytadi.
   */
  @Public()
  @ApiExcludeEndpoint()
  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
    @Body() update: TgUpdate,
  ) {
    const expected = this.bot.webhookSecret;
    if (!expected || !secret || !safeEqual(secret, expected)) {
      throw new AppException('FORBIDDEN', 'Webhook secret mos kelmadi', 403);
    }
    await this.bot.handleUpdate(update);
    return { ok: true };
  }
}
