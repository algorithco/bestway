import { Role } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';

const PHONE_RULE = /^\+?[0-9]{9,15}$/;
const PHONE_MSG = "Telefon raqam formati noto'g'ri (masalan +998901234567)";

export class QueryUsersDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  /** O'quvchilarni guruh bo'yicha filtrlash */
  @IsOptional()
  @IsString()
  groupId?: string;

  /** Ism yoki telefon bo'yicha qidiruv */
  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @Matches(PHONE_RULE, { message: PHONE_MSG })
  phone: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  /** super_admin yaratib bo'lmaydi; admin'ni faqat super_admin qo'shadi */
  @IsEnum(Role)
  role: Role;

  /** student uchun: darhol guruhga biriktirish */
  @IsOptional()
  @IsString()
  groupId?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @Matches(PHONE_RULE, { message: PHONE_MSG })
  phone?: string;

  /** Yangi parol (admin tiklab beradi) */
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password?: string;

  /** Rolni faqat super_admin o'zgartira oladi */
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** student: "Tasdiqlangan o'quvchi" statusi — barcha videolar bepul bo'ladi */
  @IsOptional()
  @IsBoolean()
  isApproved?: boolean;

  /** student: guruhga biriktirish (null = guruhdan chiqarish) */
  @IsOptional()
  @ValidateIf((o) => o.groupId !== null)
  @IsString()
  groupId?: string | null;

  /** Telegram chat ID — bildirishnomalar Telegramga ham boradi */
  @IsOptional()
  @ValidateIf((o) => o.telegramChatId !== null)
  @IsString()
  telegramChatId?: string | null;
}
