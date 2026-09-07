import { PaymentState } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * PUT /payments/bulk da qabul qilinadigan holatlar.
 * `empty` — DB dagi enum qiymati EMAS, mijoz-tomon (client-only) holat:
 * shu katakdagi Payment yozuvini o'chirish (= holat hali qayd etilmagan).
 * Payment.state ustuni nullable emas, shuning uchun Empty yozuv yo'qligi bilan ifodalanadi.
 */
export const PAYMENT_BULK_STATES = ['paid', 'unpaid', 'partial', 'empty'] as const;
export type PaymentBulkState = (typeof PAYMENT_BULK_STATES)[number];

export class QueryPaymentsDto {
  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @IsEnum(PaymentState)
  state?: PaymentState;
}

export class PaymentRecordDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsIn([...PAYMENT_BULK_STATES])
  state: PaymentBulkState;

  /** To'langan summa (so'mda) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** PUT /payments/bulk — oylik jadvalni bitta so'rovda saqlash */
export class BulkPaymentsDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PaymentRecordDto)
  records: PaymentRecordDto[];
}

/** month/year berilmasa — joriy oy */
export class DebtorsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;
}

/** studentIds berilmasa — o'sha oyning barcha qarzdorlariga yuboriladi */
export class RemindDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  studentIds?: string[];
}
