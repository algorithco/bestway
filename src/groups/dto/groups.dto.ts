import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

const TIME_RULE = /^([01]\d|2[0-3]):[0-5]\d$/;

export class ScheduleItemDto {
  @IsIn(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
  day: string;

  @Matches(TIME_RULE, { message: "Vaqt HH:MM formatida bo'lsin" })
  startTime: string;

  @Matches(TIME_RULE, { message: "Vaqt HH:MM formatida bo'lsin" })
  endTime: string;
}

export class CreateGroupDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  /** O'qituvchi user id */
  @IsOptional()
  @IsString()
  teacherId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleItemDto)
  schedule?: ScheduleItemDto[];
}

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  /** null = o'qituvchini olib tashlash */
  @IsOptional()
  @IsString()
  teacherId?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleItemDto)
  schedule?: ScheduleItemDto[];
}

export class AddStudentDto {
  /** O'quvchi user id */
  @IsString()
  @IsNotEmpty()
  studentId: string;
}
