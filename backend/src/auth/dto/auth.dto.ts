import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  /** Ism familiya */
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  /** Telefon raqam, masalan +998901234567 */
  @IsString()
  @Matches(/^\+?[0-9]{9,15}$/, {
    message: "Telefon raqam formati noto'g'ri (masalan +998901234567)",
  })
  phone: string;

  @IsString()
  @MinLength(6, { message: "Parol kamida 6 belgidan iborat bo'lsin" })
  @MaxLength(72)
  password: string;

  /** O'zi ro'yxatdan o'tish faqat student yoki parent uchun; xodimlarni admin qo'shadi */
  @IsIn(['student', 'parent'], { message: "Rol faqat student yoki parent bo'lishi mumkin" })
  role: 'student' | 'parent';
}

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class LinkChildDto {
  /** O'quvchi profilidagi 8 belgili bog'lash kodi */
  @IsString()
  @IsNotEmpty()
  linkCode: string;
}

export class LogoutDto {
  /** Berilsa faqat shu sessiya, berilmasa barcha sessiyalar yopiladi */
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
