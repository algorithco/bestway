import { Type } from 'class-transformer';
import { IsObject, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

/** POST /mock/exam-imports/validate — dry-run, hech narsa persist qilinmaydi. */
export class ValidateExamImportDto {
  /** AI tayyorlagan JSON paket (schema v1.0). Duplicate-key/size tekshiruvi raw body orqali. */
  @IsObject()
  package: Record<string, unknown>;

  /** source-key → staged upload ID (server bergan opaque ID, AI taxmini emas). */
  @IsOptional()
  @IsObject()
  mediaBindings?: Record<string, string>;
}

/** POST /mock/exam-imports — butun exam draftini bitta tranzaksiyada yaratadi. */
export class CommitExamImportDto extends ValidateExamImportDto {
  /** Dry-run dagi checksum — server qayta hisoblaydi, mos kelmasa 422. */
  @IsString()
  @Matches(/^[0-9a-f]{64}$/)
  validatedChecksum: string;

  /** Omit to create a new draft; provide an editable draft ID to append the package. */
  @IsOptional()
  @IsUUID()
  targetExamId?: string;
}

export class MediaBindingsDto {
  @IsOptional()
  @IsObject()
  @Type(() => Object)
  mediaBindings?: Record<string, string>;
}
