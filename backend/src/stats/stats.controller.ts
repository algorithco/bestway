import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { Response } from 'express';
import { Roles } from '../common/decorators';
import { ExportService } from './export.service';
import { StatsService } from './stats.service';

class IncomeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number;
}

class ExamActivityQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^(today|7d|30d|3m|6m|year)$/, { message: "range today|7d|30d|3m|6m|year bo'lsin" })
  range?: 'today' | '7d' | '30d' | '3m' | '6m' | 'year';
}

class ExportPaymentsDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;
}

class ExportAttendanceDto {
  @IsString()
  groupId: string;

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "month formati YYYY-MM bo'lsin" })
  month?: string;
}

class ExportStudentsDto {
  @IsOptional()
  @IsString()
  groupId?: string;
}

/** CSV faylini brauzerga yuborish (Excel to'g'ri ochadi) */
function csv(res: Response, filename: string, body: string): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(body);
}

@ApiTags('stats')
@ApiBearerAuth()
@Controller('stats')
export class StatsController {
  constructor(
    private readonly stats: StatsService,
    private readonly exports: ExportService,
  ) {}

  /** Admin panel bosh sahifasi: bugungi davomat, oylik tushum, navbatlar */
  @Roles('admin', 'super_admin')
  @Get('dashboard')
  dashboard() {
    return this.stats.dashboard();
  }

  /** Oxirgi oylar bo'yicha tushum grafigi */
  @Roles('admin', 'super_admin')
  @Get('income')
  income(@Query() q: IncomeQueryDto) {
    return this.stats.income(q.months ?? 6);
  }

  /** Imtihon faolligi: davr kesimida urinishlar + o'rtacha bal (combo chart) */
  @Roles('admin', 'super_admin')
  @Get('exam-activity')
  examActivity(@Query() q: ExamActivityQueryDto) {
    return this.stats.examActivity(q.range ?? '7d');
  }

  // ---------- CSV eksport ----------

  @Roles('admin', 'super_admin')
  @Get('export/students')
  async exportStudents(@Query() q: ExportStudentsDto, @Res() res: Response) {
    csv(res, 'oquvchilar.csv', await this.exports.students(q.groupId));
  }

  @Roles('admin', 'super_admin')
  @Get('export/payments')
  async exportPayments(@Query() q: ExportPaymentsDto, @Res() res: Response) {
    const name = q.month ? `tolovlar-${q.year}-${q.month}.csv` : `tolovlar-${q.year}.csv`;
    csv(res, name, await this.exports.payments(q.year, q.month));
  }

  @Roles('admin', 'super_admin')
  @Get('export/attendance')
  async exportAttendance(@Query() q: ExportAttendanceDto, @Res() res: Response) {
    csv(res, `davomat-${q.month ?? 'joriy-oy'}.csv`, await this.exports.attendance(q.groupId, q.month));
  }
}
