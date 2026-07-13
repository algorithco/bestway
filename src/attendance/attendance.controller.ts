import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/types';
import { AttendanceService } from './attendance.service';
import {
  AttendanceStatsQueryDto,
  BulkAttendanceDto,
  QueryAttendanceDto,
} from './dto/attendance.dto';

@ApiTags('attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  /** Davomat jadvali (oy bo'yicha). O'quvchi/ota-ona faqat o'zinikini ko'radi */
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: QueryAttendanceDto) {
    return this.attendance.list(user, q);
  }

  /** Oylik statistika (keldi/kelmadi/kechikdi) */
  @Get('stats')
  @Roles('teacher', 'admin', 'super_admin')
  stats(@CurrentUser() user: AuthUser, @Query() q: AttendanceStatsQueryDto) {
    return this.attendance.stats(user, q);
  }

  /** Kunlik davomatni bitta so'rovda saqlash (o'qituvchi o'z guruhida) */
  @Put('bulk')
  @Roles('teacher', 'admin', 'super_admin')
  bulk(@CurrentUser() user: AuthUser, @Body() dto: BulkAttendanceDto) {
    return this.attendance.bulkUpsert(user, dto);
  }
}
