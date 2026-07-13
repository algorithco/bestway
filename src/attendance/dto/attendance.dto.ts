import { AttendanceState } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

export class QueryAttendanceDto {
  /** teacher/admin uchun majburiy */
  @IsOptional()
  @IsString()
  groupId?: string;

  /** "YYYY-MM" — berilmasa joriy oy */
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "month formati YYYY-MM bo'lsin" })
  month?: string;

  @IsOptional()
  @IsString()
  studentId?: string;
}

export class AttendanceRecordDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsEnum(AttendanceState)
  state: AttendanceState;
}

/** Bitta so'rovda butun kunlik jadval saqlanadi (Excel-simon panel) */
export class BulkAttendanceDto {
  @IsString()
  @IsNotEmpty()
  groupId: string;

  /** Sana: "2026-07-10" */
  @IsISO8601()
  date: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecordDto)
  records: AttendanceRecordDto[];
}

export class AttendanceStatsQueryDto {
  @IsString()
  @IsNotEmpty()
  groupId: string;

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "month formati YYYY-MM bo'lsin" })
  month?: string;
}
