import { Global, Module } from '@nestjs/common';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramController } from './telegram.controller';
import { TelegramLinkService } from './telegram-link.service';
import { TelegramMenuService } from './telegram-menu.service';
import { TelegramService } from './telegram.service';

/**
 * Global: NotificationsService xabar yuborish uchun TelegramService'dan foydalanadi.
 * TelegramBotService modul ko'tarilganda polling/webhook'ni ishga tushiradi.
 */
@Global()
@Module({
  controllers: [TelegramController],
  providers: [TelegramService, TelegramLinkService, TelegramMenuService, TelegramBotService],
  exports: [TelegramService, TelegramLinkService],
})
export class TelegramModule {}
