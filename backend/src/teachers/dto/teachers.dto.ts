import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// Ochiq API orqali qaytadi — javascript:/data: sxemalarni taqiqlaymiz.
const SAFE_URL = /^(https?:\/\/[^\s]+|\/[^\s]*)$/;
const SAFE_URL_MSG = "Havola https:// bilan yoki / bilan boshlanishi kerak";

// multipart/form-data'da qiymatlar satr bo'lib keladi — booleanni qo'lda o'giramiz
const toBool = ({ value }: { value: unknown }) => value === true || value === 'true';

export class CreateTeacherDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  /** Yo'nalish / mutaxassislik — masalan "Academic IELTS" */
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  specialty: string;

  /** Yutuq yoki sertifikat — masalan "IELTS 8.5" */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  achievement?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  /** Ish tajribasi (yil) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(80)
  experienceYears?: number;

  /** Ijtimoiy tarmoq / Telegram havolasi */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Matches(SAFE_URL, { message: SAFE_URL_MSG })
  socialUrl?: string;

  /** Saytdagi ko'rinish tartibi (kichik son — oldinroq) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  /** Saytda ko'rsatilsinmi (standart: true) */
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTeacherDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  specialty?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  achievement?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(80)
  experienceYears?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Matches(SAFE_URL, { message: SAFE_URL_MSG })
  socialUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isActive?: boolean;
}
