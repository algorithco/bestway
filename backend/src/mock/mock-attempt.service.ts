import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MockAttempt, Prisma } from '@prisma/client';
import { AppException } from '../common/app.exception';
import { AuthUser } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../videos/storage.service';
import {
  BulkAnswersDto,
  FlagCheatDto,
  SaveAnnotationsDto,
  SaveAnswerDto,
  StartAttemptDto,
} from './dto/mock.dto';
import { MockAccessService } from './mock-access.service';
import { ExamRow, shapeExam, totalDuration } from './mock-shape';

export const MOCK_EXAM_INCLUDE = {
  sections: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      groups: {
        orderBy: { sortOrder: 'asc' as const },
        include: { questions: { orderBy: { sortOrder: 'asc' as const } } },
      },
    },
  },
} satisfies Prisma.MockExamInclude;

@Injectable()
export class MockAttemptService {
  private readonly base: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MockAccessService,
    private readonly storage: StorageService,
    config: ConfigService,
  ) {
    this.base = `${config.get<string>('PUBLIC_URL') ?? 'http://localhost:3001'}/v1`;
  }

  /** POST /mock/exams/:id/start — urinish ochadi (yoki tugallanmaganini davom ettiradi) */
  async start(student: AuthUser, examId: string, dto: StartAttemptDto) {
    if (!student.studentProfile) {
      throw new AppException('NOT_A_STUDENT', "Faqat o'quvchi imtihon topshira oladi", 403);
    }
    const exam = await this.prisma.mockExam.findUnique({
      where: { id: examId },
      include: MOCK_EXAM_INCLUDE,
    });
    if (!exam) throw new AppException('MOCK_EXAM_NOT_FOUND', 'Mock imtihon topilmadi', 404);
    if (!exam.isPublished && !exam.isDemo) {
      throw new AppException('MOCK_EXAM_NOT_PUBLISHED', 'Bu imtihon hali ochilmagan', 400);
    }
    // Pullik kirish tekshiruvi
    await this.access.assertCanStart(student, exam);

    const shaped = shapeExam(exam as unknown as ExamRow, false, this.base);
    if (shaped.questionCount === 0) {
      throw new AppException('MOCK_EXAM_EMPTY', "Bu imtihonda hali savollar yo'q", 400);
    }

    const existing = await this.prisma.mockAttempt.findFirst({
      where: { studentId: student.id, examId, status: 'in_progress' },
      include: { answers: true },
    });
    if (existing) {
      return {
        attemptId: existing.id,
        resumed: true,
        mode: existing.mode,
        startedAt: existing.startedAt,
        deadlineAt: existing.deadlineAt,
        serverTime: new Date(),
        durationMinutes: totalDuration(exam as unknown as ExamRow),
        exam: shaped,
        annotations: existing.annotations ?? [],
        savedAnswers: Object.fromEntries(
          existing.answers.map((a) => [a.questionId, a.audioKey ? '[audio]' : a.response]),
        ),
      };
    }

    const mode = dto.mode ?? 'practice';
    const duration = totalDuration(exam as unknown as ExamRow);
    const deadlineAt =
      mode === 'timed' && duration ? new Date(Date.now() + duration * 60_000) : null;

    const attempt = await this.prisma.mockAttempt.create({
      data: { examId, studentId: student.id, mode, deadlineAt },
    });
    return {
      attemptId: attempt.id,
      resumed: false,
      mode: attempt.mode,
      startedAt: attempt.startedAt,
      deadlineAt: attempt.deadlineAt,
      serverTime: new Date(),
      durationMinutes: duration,
      exam: shaped,
      annotations: [],
      savedAnswers: {},
    };
  }

  /** POST /mock/attempts/:attemptId/answer — bitta javobni saqlash (upsert) */
  async saveAnswer(student: AuthUser, attemptId: string, dto: SaveAnswerDto) {
    const attempt = await this.ownAttempt(student, attemptId);
    this.assertInProgress(attempt.status);
    this.assertNotTimedOut(attempt);
    await this.assertQuestionInExam(attempt.examId, dto.questionId);
    await this.prisma.mockAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId: dto.questionId } },
      update: { response: dto.response },
      create: { attemptId, questionId: dto.questionId, response: dto.response },
    });
    return { saved: true };
  }

  /** POST /mock/attempts/:attemptId/answers — bir nechta javobni birdan saqlash */
  async bulkAnswers(student: AuthUser, attemptId: string, dto: BulkAnswersDto) {
    const attempt = await this.ownAttempt(student, attemptId);
    this.assertInProgress(attempt.status);
    this.assertNotTimedOut(attempt);

    const valid = await this.prisma.mockQuestion.findMany({
      where: {
        group: { section: { examId: attempt.examId } },
        id: { in: dto.answers.map((a) => a.questionId) },
      },
      select: { id: true },
    });
    const validIds = new Set(valid.map((v) => v.id));
    const items = dto.answers.filter((a) => validIds.has(a.questionId));
    if (items.length === 0) {
      throw new AppException('QUESTION_NOT_IN_EXAM', 'Javoblar bu imtihonga tegishli emas', 400);
    }

    await this.prisma.$transaction(
      items.map((a) =>
        this.prisma.mockAnswer.upsert({
          where: { attemptId_questionId: { attemptId, questionId: a.questionId } },
          update: { response: a.response },
          create: { attemptId, questionId: a.questionId, response: a.response },
        }),
      ),
    );
    return { saved: items.length };
  }

  /** POST /mock/attempts/:attemptId/speaking/:questionId — Speaking audio javobini yuklash */
  async uploadSpeaking(
    student: AuthUser,
    attemptId: string,
    questionId: string,
    file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new AppException('NO_FILE', 'Audio fayl yuklanmadi', 400);
    const attempt = await this.ownAttempt(student, attemptId);
    this.assertInProgress(attempt.status);
    this.assertNotTimedOut(attempt);

    const q = await this.prisma.mockQuestion.findFirst({
      where: { id: questionId, group: { section: { examId: attempt.examId, skill: 'speaking' } } },
      select: { id: true },
    });
    if (!q) {
      throw new AppException(
        'NOT_SPEAKING_QUESTION',
        'Bu savol speaking emas yoki imtihonga tegishli emas',
        400,
      );
    }
    const key = `mock/${file.filename}`;
    const existing = await this.prisma.mockAnswer.findUnique({
      where: { attemptId_questionId: { attemptId, questionId } },
    });
    if (existing?.audioKey) this.storage.delete(existing.audioKey);
    await this.prisma.mockAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      update: { audioKey: key },
      create: { attemptId, questionId, response: '', audioKey: key },
    });
    return {
      saved: true,
      audioUrl: `${this.base}/mock/attempts/${attemptId}/answers/${questionId}/audio`,
    };
  }

  /** PUT /mock/attempts/:attemptId/annotations — highlight/eslatmalarni saqlash */
  async saveAnnotations(student: AuthUser, attemptId: string, dto: SaveAnnotationsDto) {
    await this.ownAttempt(student, attemptId);
    await this.prisma.mockAttempt.update({
      where: { id: attemptId },
      data: { annotations: (dto.annotations ?? []) as Prisma.InputJsonValue },
    });
    return { saved: true };
  }

  /** POST /mock/attempts/:attemptId/flag-cheat — tab almashtirish signali */
  async flagCheat(student: AuthUser, attemptId: string, dto: FlagCheatDto) {
    const attempt = await this.ownAttempt(student, attemptId);
    if (attempt.status !== 'in_progress') return { saved: true };
    await this.prisma.$transaction([
      this.prisma.mockCheatEvent.create({ data: { attemptId, event: dto.event } }),
      this.prisma.mockAttempt.update({
        where: { id: attemptId },
        data: { antiCheatCount: { increment: 1 } },
      }),
    ]);
    return { saved: true };
  }

  // ─────────────────────────── Helpers ───────────────────────────

  private async ownAttempt(student: AuthUser, attemptId: string): Promise<MockAttempt> {
    const attempt = await this.prisma.mockAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.studentId !== student.id) {
      throw new AppException('MOCK_ATTEMPT_NOT_FOUND', 'Urinish topilmadi', 404);
    }
    return attempt;
  }

  private assertInProgress(status: string): void {
    if (status !== 'in_progress') {
      throw new AppException('MOCK_ATTEMPT_FINISHED', 'Bu urinish allaqachon yakunlangan', 400);
    }
  }

  /** Vaqtli rejimda muddat o'tgan bo'lsa javob qabul qilinmaydi (yakunlang) */
  private assertNotTimedOut(attempt: MockAttempt): void {
    if (attempt.mode === 'timed' && attempt.deadlineAt && Date.now() > attempt.deadlineAt.getTime()) {
      throw new AppException('MOCK_TIME_UP', 'Vaqt tugadi — imtihonni yakunlang', 400);
    }
  }

  private async assertQuestionInExam(examId: string, questionId: string): Promise<void> {
    const q = await this.prisma.mockQuestion.findFirst({
      where: { id: questionId, group: { section: { examId } } },
      select: { id: true },
    });
    if (!q) {
      throw new AppException('QUESTION_NOT_IN_EXAM', 'Savol bu imtihonga tegishli emas', 400);
    }
  }
}
