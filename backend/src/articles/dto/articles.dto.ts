import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';

export class QueryArticlesDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  tag?: string;
}

export class CreateArticleDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  title: string;

  @IsString()
  @MinLength(10)
  body: string;

  /** Masalan: yangiliklar, maslahatlar, kurslar */
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  category: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateArticleDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  body?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
