import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/types';
import { CommitExamImportDto, ValidateExamImportDto } from './dto/mock-import.dto';
import { MockExamImportService } from './mock-exam-import.service';
import { stagedImportMulterOptions } from './mock-storage';

function rawBodyOf(req: Request): string | undefined {
  const raw = (req as unknown as { rawBody?: unknown }).rawBody;
  return typeof raw === 'string' ? raw : undefined;
}

/**
 * AI JSON test import — browser HttpOnly cookie sessiyasi orqali.
 * Hamma yozish staff-only; JSON hech qachon avtomatik publish qilmaydi.
 */
@ApiTags('mock-import')
@ApiBearerAuth()
@Controller('mock/exam-imports')
export class MockExamImportController {
  constructor(private readonly imports: MockExamImportService) {}

  /** Dry-run: normalize + report, persist qilinmaydi. */
  @Roles('teacher', 'admin', 'super_admin')
  @Post('validate')
  @HttpCode(200)
  validate(
    @CurrentUser() user: AuthUser,
    @Body() dto: ValidateExamImportDto,
    @Req() req: Request,
  ) {
    return this.imports.validateDryRun(user, dto.package, dto.mediaBindings ?? {}, rawBodyOf(req));
  }

  /** Staged media upload (multipart: file) — opaque upload ID qaytaradi. */
  @Roles('teacher', 'admin', 'super_admin')
  @ApiConsumes('multipart/form-data')
  @Post('media')
  @UseInterceptors(FileInterceptor('file', stagedImportMulterOptions()))
  @HttpCode(201)
  stageMedia(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File) {
    return this.imports.stageMedia(user, file);
  }

  /** Yangi draft yaratadi yoki tanlangan draftga atomik qo'shadi (yangi 201, replay 200). */
  @Roles('teacher', 'admin', 'super_admin')
  @Post()
  commit(
    @CurrentUser() user: AuthUser,
    @Body() dto: CommitExamImportDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.imports
      .commitImport(
        user,
        dto.package,
        dto.mediaBindings ?? {},
        dto.validatedChecksum,
        rawBodyOf(req),
        dto.targetExamId,
      )
      .then((result) => {
        res.status(result.replay ? 200 : 201);
        return result;
      });
  }

  /** Yo'qolgan javobdan keyin holatni tiklash (egasi yoki admin). */
  @Roles('teacher', 'admin', 'super_admin')
  @Get('by-package/:packageId/revisions/:revision')
  status(
    @CurrentUser() user: AuthUser,
    @Param('packageId') packageId: string,
    @Param('revision', ParseIntPipe) revision: number,
  ) {
    return this.imports.getByPackage(user, packageId, revision);
  }

  /** Exam Builder provenance: paket kimligi + ochiq issue lar + source xarita. */
  @Roles('teacher', 'admin', 'super_admin')
  @Get('by-exam/:examId')
  byExam(@CurrentUser() user: AuthUser, @Param('examId') examId: string) {
    return this.imports.getByExam(user, examId);
  }

  /** Ochiq issue ni yopish — egasi yoki admin (publish gate ochiladi). */
  @Roles('teacher', 'admin', 'super_admin')
  @Post('issues/:issueId/resolve')
  @HttpCode(200)
  resolveIssue(@CurrentUser() user: AuthUser, @Param('issueId') issueId: string) {
    return this.imports.resolveIssue(user, issueId);
  }
}
