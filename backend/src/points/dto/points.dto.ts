import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  NotEquals,
} from 'class-validator';

export class AdjustPointsDto {
  /** O'zgarish: musbat = qo'shish, manfiy = ayirish (0 bo'lishi mumkin emas) */
  @Type(() => Number)
  @IsInt()
  @NotEquals(0, { message: "O'zgarish 0 bo'lishi mumkin emas" })
  change: number;

  /** Sabab — majburiy (biznes-qoida: ball har doim sabab bilan yoziladi) */
  @IsString()
  @MinLength(3, { message: 'Sabab kamida 3 belgidan iborat bo\'lsin' })
  @MaxLength(300)
  reason: string;
}

export class LeaderboardQueryDto {
  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
