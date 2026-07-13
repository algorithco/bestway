import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditService } from '../audit/audit.service';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/types';
import { UpdateSettingsDto } from './dto/settings.dto';
import { SETTING_KEYS, SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  /** Tizim sozlamalari (ball limitlari) */
  @Get()
  @Roles('super_admin', 'admin', 'teacher')
  get() {
    return this.settings.all();
  }

  /** Sozlamalarni o'zgartirish — faqat Super Admin */
  @Patch()
  @Roles('super_admin')
  async update(@CurrentUser() user: AuthUser, @Body() dto: UpdateSettingsDto) {
    const old = await this.settings.all();
    if (dto.teacherPointLimit !== undefined) {
      await this.settings.setNumber(SETTING_KEYS.teacherPointLimit, dto.teacherPointLimit);
    }
    if (dto.initialPoints !== undefined) {
      await this.settings.setNumber(SETTING_KEYS.initialPoints, dto.initialPoints);
    }
    if (dto.monthlyFee !== undefined) {
      await this.settings.setNumber(SETTING_KEYS.monthlyFee, dto.monthlyFee);
    }
    if (dto.gameThreshold !== undefined) {
      await this.settings.setNumber(SETTING_KEYS.gameThreshold, dto.gameThreshold);
    }
    const fresh = await this.settings.all();
    await this.audit.log({
      userId: user.id,
      action: 'settings.update',
      entity: 'setting',
      oldValue: old,
      newValue: fresh,
    });
    return fresh;
  }
}
