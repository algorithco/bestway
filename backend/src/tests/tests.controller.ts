import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { CurrentUser, OptionalAuth, Public, Roles } from '../common/decorators';
import { AuthUser } from '../common/types';
import { CertificateService } from './certificate.service';
import {
  CreateQuestionDto,
  CreateTestDto,
  DemoSubmitDto,
  FlagCheatDto,
  GradeAnswerDto,
  ImportQuestionsDto,
  QueryAttemptsDto,
  QueryTestsDto,
  SaveMarksDto,
  SubmitAnswerDto,
  UpdateQuestionDto,
  UpdateTestDto,
} from './dto/tests.dto';
import { GradingService } from './grading.service';
import { TestsService } from './tests.service';
import { testAudioMulterOptions } from './tests-storage';

// Diqqat: 'attempts/...' va 'questions/...' va 'demo/...' marshrutlari ':id' dan OLDIN e'lon qilinadi
@ApiTags('tests')
@Controller('tests')
export class TestsController {
  constructor(
    private readonly tests: TestsService,
    private readonly grading: GradingService,
    private readonly certificates: CertificateService,
  ) {}

  /** Testlar ro'yxati — mehmonlar faqat demo testlarni ko'radi — paginated (?page=&limit=&type=) */
  @OptionalAuth()
  @Get()
  list(@CurrentUser() user: AuthUser | undefined, @Query() q: QueryTestsDto) {
    return this.tests.list(user, q);
  }

  // ---------- Demo (guest-friendly, no auth) ----------

  /** Demo testlar — mehmonlar uchun ochiq ro'yxat (?page=&limit=&type=) */
  @Public()
  @Get('demo/list')
  listDemo(@Query() q: QueryTestsDto) {
    return this.tests.listDemo(q);
  }

  /** Bulk paste dry run — parses and validates without writing to the database. */
  @ApiBearerAuth()
  @Roles('admin', 'super_admin')
  @Post('questions/import/preview')
  previewQuestionImport(@Body() dto: ImportQuestionsDto) {
    return this.tests.previewQuestionImport(dto);
  }

  /** Demo test tafsiloti — mehmonlar uchun (audio/passage bilan, correctAnswer siz) */
  @Public()
  @Get('demo/:id')
  getDemo(@Param('id') id: string) {
    return this.tests.getDemo(id);
  }

  /** Demo testni anonim baholash — DB yozmaydi, per-question correctness bilan */
  @Public()
  @Post('demo/:id/submit')
  submitDemo(@Param('id') id: string, @Body() dto: DemoSubmitDto) {
    return this.tests.scoreDemo(id, dto);
  }

  /** Yangi test yaratish */
  @ApiBearerAuth()
  @Roles('admin', 'super_admin')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTestDto) {
    return this.tests.createTest(user, dto);
  }

  // ---------- Urinishlar ----------

  /** Urinishlar ro'yxati (o'qituvchi baholash paneli: ?status=grading) */
  @ApiBearerAuth()
  @Roles('teacher', 'admin', 'super_admin')
  @Get('attempts')
  listAttempts(@CurrentUser() user: AuthUser, @Query() q: QueryAttemptsDto) {
    return this.grading.listAttempts(user, q);
  }

  /** O'quvchining o'z natijalari */
  @ApiBearerAuth()
  @Roles('student')
  @Get('attempts/mine')
  myAttempts(@CurrentUser() user: AuthUser, @Query() q: QueryAttemptsDto) {
    return this.grading.myAttempts(user, q);
  }

  /** Urinish tafsiloti (javoblar bilan) */
  @ApiBearerAuth()
  @Get('attempts/:attemptId')
  getAttempt(@CurrentUser() user: AuthUser, @Param('attemptId') attemptId: string) {
    return this.grading.getAttempt(user, attemptId);
  }

  /** Javobni saqlash */
  @ApiBearerAuth()
  @Roles('student')
  @Post('attempts/:attemptId/answer')
  answer(
    @CurrentUser() user: AuthUser,
    @Param('attemptId') attemptId: string,
    @Body() dto: SubmitAnswerDto,
  ) {
    return this.tests.answer(user, attemptId, dto);
  }

  /** Reading highlight + shaxsiy eslatma (javob matniga tegmaydi) */
  @ApiBearerAuth()
  @Roles('student')
  @Post('attempts/:attemptId/marks')
  saveMarks(
    @CurrentUser() user: AuthUser,
    @Param('attemptId') attemptId: string,
    @Body() dto: SaveMarksDto,
  ) {
    return this.tests.saveMarks(user, attemptId, dto);
  }

  /** Anti-cheat signal (tab almashtirish va h.k.) */
  @ApiBearerAuth()
  @Roles('student')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('attempts/:attemptId/flag-cheat')  flagCheat(
    @CurrentUser() user: AuthUser,
    @Param('attemptId') attemptId: string,
    @Body() dto: FlagCheatDto,
  ) {
    return this.tests.flagCheat(user, attemptId, dto);
  }

  /** Testni topshirish — Listening/Reading avtomatik baholanadi */
  @ApiBearerAuth()
  @Roles('student')
  @Post('attempts/:attemptId/submit')
  submit(@CurrentUser() user: AuthUser, @Param('attemptId') attemptId: string) {
    return this.grading.submit(user, attemptId);
  }

  /** Writing/Speaking ni qo'lda baholash (o'qituvchi) */
  @ApiBearerAuth()
  @Roles('teacher', 'admin', 'super_admin')
  @Post('attempts/:attemptId/grade')
  grade(
    @CurrentUser() user: AuthUser,
    @Param('attemptId') attemptId: string,
    @Body() dto: GradeAnswerDto,
  ) {
    return this.grading.grade(user, attemptId, dto);
  }

  /** Natija sertifikati (PDF) */
  @ApiBearerAuth()
  @Get('attempts/:attemptId/certificate')
  async certificate(
    @CurrentUser() user: AuthUser,
    @Param('attemptId') attemptId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const data = await this.grading.certificateData(user, attemptId);
    const pdf = await this.certificates.generate(data);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="certificate-${attemptId}.pdf"`,
    });
    return new StreamableFile(pdf);
  }

  // ---------- Savollar ----------

  /** Savol audio yuklash — admin; multipart field "audio" (50MB, audio/*) */
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @Roles('admin', 'super_admin')
  @Post('questions/:questionId/audio')
  @UseInterceptors(FileInterceptor('audio', testAudioMulterOptions()))
  uploadQuestionAudio(
    @CurrentUser() user: AuthUser,
    @Param('questionId') questionId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.tests.setQuestionAudio(user, questionId, file);
  }

  /** Savol audiosini oqim bilan olish — demo uchun guest ruxsat, Range qo'llab-quvvatlanadi */
  @Public()
  @Get('questions/:questionId/audio')
  questionAudio(@Param('questionId') questionId: string, @Req() req: Request, @Res() res: Response) {
    return this.tests.streamQuestionAudio(questionId, req, res);
  }

  /** Savolni tahrirlash */
  @ApiBearerAuth()
  @Roles('admin', 'super_admin')
  @Patch('questions/:questionId')
  updateQuestion(
    @CurrentUser() user: AuthUser,
    @Param('questionId') questionId: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.tests.updateQuestion(user, questionId, dto);
  }

  /** Savolni o'chirish */
  @ApiBearerAuth()
  @Roles('admin', 'super_admin')
  @Delete('questions/:questionId')
  deleteQuestion(@CurrentUser() user: AuthUser, @Param('questionId') questionId: string) {
    return this.tests.deleteQuestion(user, questionId);
  }

  // ---------- Test (':id' bilan) ----------

  /** Test tafsiloti (xodimlar savollarni javoblari bilan ko'radi) */
  @ApiBearerAuth()
  @Get(':id')
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tests.getOne(user, id);
  }

  /** Testni tahrirlash (faollik, davomiylik va h.k.) */
  @ApiBearerAuth()
  @Roles('admin', 'super_admin')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateTestDto) {
    return this.tests.updateTest(user, id, dto);
  }

  /** Testni boshlash — savollar random tanlanadi */
  @ApiBearerAuth()
  @Roles('student')
  @Post(':id/start')
  start(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tests.start(user, id);
  }

  /** Testga savol qo'shish */
  @ApiBearerAuth()
  @Roles('admin', 'super_admin')
  @Post(':id/questions')
  addQuestion(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.tests.addQuestion(user, id, dto);
  }


  /** Parse and atomically add a complete pasted question batch. */
  @ApiBearerAuth()
  @Roles('admin', 'super_admin')
  @Post(':id/questions/import')
  importQuestions(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ImportQuestionsDto,
  ) {
    return this.tests.importQuestions(user, id, dto);
  }
}
