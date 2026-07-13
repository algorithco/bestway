import {
  MockAttemptMode,
  MockAttemptStatus,
  MockExamType,
  MockQuestionType,
  MockSkill,
  PurchaseStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';

/* ─────────────────────────── Exam ─────────────────────────── */

export class CreateMockExamDto {
  @IsEnum(MockExamType)
  type: MockExamType;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  level?: string;

  @IsOptional()
  @IsBoolean()
  isDemo?: boolean;

  /** Narx (so'mda); 0 = bepul */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsBoolean()
  isFreeForApproved?: boolean;
}

export class UpdateMockExamDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  level?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsBoolean()
  isDemo?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsBoolean()
  isFreeForApproved?: boolean;
}

export class ListExamsQueryDto {
  @IsOptional()
  @IsEnum(MockExamType)
  type?: MockExamType;
}

/* ─────────────────────────── Section ─────────────────────────── */

export class CreateSectionDto {
  @IsEnum(MockSkill)
  skill: MockSkill;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(300)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instructions?: string;
}

export class UpdateSectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(300)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instructions?: string;
}

/* ─────────────────────────── Group (passage/audio blok) ─────────────────────────── */

export class CreateGroupDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instructions?: string;

  /** Reading matni yoki Listening transkripti */
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  passageText?: string;
}

export class UpdateGroupDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instructions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  passageText?: string;
}

/* ─────────────────────────── Question ─────────────────────────── */

export class QuestionInputDto {
  /** Imtihondagi savol raqami (1..40) */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  number: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsEnum(MockQuestionType)
  type: MockQuestionType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  prompt: string;

  /** multiple_choice / matching uchun variantlar */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(26)
  options?: string[];

  /** Qabul qilinadigan to'g'ri javob(lar) — auto-baholanadigan savollar uchun */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  correctAnswers?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  points?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  wordLimit?: number;
}

/** Bitta so'rovda bir nechta savol qo'shish (kuchli javob-kaliti kiritish) */
export class AddQuestionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => QuestionInputDto)
  questions: QuestionInputDto[];
}

export class UpdateQuestionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  number?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsEnum(MockQuestionType)
  type?: MockQuestionType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  prompt?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(26)
  options?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  correctAnswers?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  points?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  wordLimit?: number;
}

/* ─────────────────────────── Attempt oqimi ─────────────────────────── */

export class SaveAnswerDto {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  /** O'quvchi javobi (bo'sh satr = javobni tozalash) */
  @IsString()
  @MaxLength(10000)
  response: string;
}

class AnswerItemDto {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @IsString()
  @MaxLength(10000)
  response: string;
}

export class BulkAnswersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AnswerItemDto)
  answers: AnswerItemDto[];
}

export class FlagCheatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  event: string;
}

export class GradeMockAnswerDto {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  /** Writing/Speaking uchun band (0–9) yoki ball (0..points), 0.5 qadam mumkin */
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  score: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  feedback?: string;
}

export class ListAttemptsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(MockAttemptStatus)
  status?: MockAttemptStatus;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  examId?: string;
}

/* ─────────────────────────── Start / rejim ─────────────────────────── */

export class StartAttemptDto {
  /** `practice` (vaqtsiz) yoki `timed` (vaqtli, ekran full). Standart: practice */
  @IsOptional()
  @IsEnum(MockAttemptMode)
  mode?: MockAttemptMode;
}

/* ─────────────────────────── Savol parse / import ─────────────────────────── */

export class ParseQuestionsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  text: string;
}

export class ImportQuestionsDto {
  /** Yopishtirilgan savollar matni */
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  text: string;

  /** Javob kaliti: { "1": "B", "2": "flowers/flower", "3": "TRUE" } */
  @IsOptional()
  @IsObject()
  answers?: Record<string, string>;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  points?: number;
}

/* ─────────────────────────── Xarid (pullik kirish) ─────────────────────────── */

export class ConfirmPurchaseDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class ListPurchasesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(PurchaseStatus)
  status?: PurchaseStatus;
}

/* ─────────────────────────── Highlight / annotatsiya ─────────────────────────── */

export class SaveAnnotationsDto {
  /** Frontend highlight/eslatmalari (ixtiyoriy struktura) */
  @IsOptional()
  @IsArray()
  annotations?: unknown[];
}
