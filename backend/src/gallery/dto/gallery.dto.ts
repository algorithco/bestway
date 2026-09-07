import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

const toBool = ({ value }: { value: unknown }) => value === true || value === 'true';
// Ochiq API orqali qaytadi va frontend <a href> qiladi — javascript:/data: sxemalarni taqiqlaymiz.
const SAFE_LINK = /^(https?:\/\/[^\s]+|\/[^\s]*)$/;
const SAFE_LINK_MSG = "Havola https:// bilan yoki / bilan boshlanishi kerak";

export class CreateGalleryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(SAFE_LINK, { message: SAFE_LINK_MSG })
  link?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  alt?: string;

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

export class UpdateGalleryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(SAFE_LINK, { message: SAFE_LINK_MSG })
  link?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  alt?: string;

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
