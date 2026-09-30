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
  @MinLength(8, { message: "Parol kamida 8 belgidan iborat bo'lsin" })
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

/** PATCH /auth/me — foydalanuvchi o'z ismini tahrirlaydi (barcha rollar) */
export class UpdateMeDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;
}

export class DesktopAuthorizeDto {
  /** Desktop qurilma identifikatori (login sahifasidan keladi) */
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  deviceId: string;

  /** CSRF tokeni — desktop uni qaytgan `state` bilan solishtiradi */
  @IsString()
  @IsNotEmpty()
  @MinLength(16)
  @MaxLength(128)
  state: string;

  /** PKCE-S256 challenge: BASE64URL(SHA256(verifier)), har doim 43 belgi */
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9_-]{43}$/, { message: "codeChallenge PKCE-S256 formatida bo'lishi kerak" })
  codeChallenge: string;

  /** Faqat ruxsat etilgan deep-link manzil (open-redirect himoyasi) */
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  redirect: string;
}

export class DesktopExchangeDto {
  /** Web sahifada ko'rsatilgan bir martalik kod */
  @IsString()
  @IsNotEmpty()
  code: string;

  /** PKCE verifier (raw) — challenge bilan solishtiriladi */
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  verifier: string;

  /** Kod yaratilgandagi deviceId bilan bir xil bo'lishi shart */
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  deviceId: string;
}
