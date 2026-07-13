import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser, OptionalAuth, Roles } from '../common/decorators';
import { AuthUser } from '../common/types';
import { CertificateService } from './certificate.service';
import {
  CreateQuestionDto,
  CreateTestDto,
  FlagCheatDto,
  GradeAnswerDto,
  QueryAttemptsDto,
  QueryTestsDto,
  SubmitAnswerDto,
  UpdateQuestionDto,
  UpdateTestDto,
} from './dto/tests.dto';
import { GradingService } from './grading.service';
import { TestsService } from './tests.service';

// Diqqat: 'attempts/...' va 'questions/...' marshrutlari ':id' dan OLDIN e'lon qilinadi
@ApiTags('tests')
@Controller('tests')
export class TestsController {
  constructor(
    private readonly tests: TestsService,
    private readonly grading: GradingService,
    private readonly certificates: CertificateService,
  ) {}

  /** Testlar ro'yxati — mehmonlar faqat demo testlarni ko'radi */
  @OptionalAuth()
  @Get()
  list(@CurrentUser() user: AuthUser | undefined, @Query() q: QueryTestsDto) {
    return this.tests.list(user, q);
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

  /** Anti-cheat signal (tab almashtirish va h.k.) */
  @ApiBearerAuth()
  @Roles('student')
  @Post('attempts/:attemptId/flag-cheat')
  flagCheat(
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
}
