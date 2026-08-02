import { PurchaseStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';

const toBool = ({ value }: { value: unknown }) => value === true || value === 'true';

export class CreateVideoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /** Narx so'mda; 0 = hamma uchun bepul */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  price: number;

  /** Tasdiqlangan o'quvchi uchun bepulmi (standart: true) */
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isFreeForApproved?: boolean;
}

export class UpdateVideoDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  price?: number;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isFreeForApproved?: boolean;
}

export class ConfirmPurchaseDto {
  /** Sotib olishi tasdiqlanadigan foydalanuvchi (user id) */
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class QueryPurchasesDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(PurchaseStatus)
  status?: PurchaseStatus;
}
