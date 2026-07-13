import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateSettingsDto {
  /** O'qituvchi bir amalda qo'sha/ayira oladigan maksimal ball */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  teacherPointLimit?: number;

  /** Yangi o'quvchiga beriladigan boshlang'ich ball */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  initialPoints?: number;

  /** Standart oylik to'lov summasi (so'm) */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  monthlyFee?: number;

  /** Oylik o'yinga qo'shilish uchun kerakli chegara ball */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  gameThreshold?: number;
}
