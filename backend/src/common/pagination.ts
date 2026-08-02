import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
}

/**
 * Ro'yxat javoblari uchun konteyner — TransformInterceptor buni
 * { success: true, data: [...], meta: {...} } ko'rinishiga o'giradi.
 */
export class Paginated<T = unknown> {
  constructor(
    public readonly items: T[],
    public readonly meta: PageMeta,
  ) {}
}

export class PaginationQueryDto {
  /** Sahifa raqami (1 dan) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  /** Sahifadagi elementlar soni */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}
