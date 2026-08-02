import { Role } from '@prisma/client';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export type BroadcastAudience = 'all' | 'role' | 'group' | 'debtors';

export class BroadcastDto {
  /**
   * all     — barcha faol foydalanuvchilar
   * role    — tanlangan rol (role maydoni majburiy)
   * group   — guruh o'quvchilari (groupId majburiy)
   * debtors — joriy oyning qarzdorlari
   */
  @IsIn(['all', 'role', 'group', 'debtors'])
  audience: BroadcastAudience;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsString()
  groupId?: string;

  /** Guruh/qarzdorlar tanlanganda ota-onalarga ham yuborilsinmi */
  @IsOptional()
  @IsBoolean()
  includeParents?: boolean;

  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  text: string;
}
