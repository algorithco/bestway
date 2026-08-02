import { Injectable } from '@nestjs/common';
import { Prisma, Question, TestSection } from '@prisma/client';
import { randomInt } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/app.exception';
import { AuthUser } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateQuestionDto,
  CreateTestDto,
  QueryTestsDto,
  SubmitAnswerDto,
  FlagCheatDto,
  UpdateQuestionDto,
  UpdateTestDto,
} from './dto/tests.dto';

export const MANUAL_SECTIONS: TestSection[] = ['writing', 'speaking'];
export const SECTION_ORDER: TestSection[] = ['listening', 'reading', 'writing', 'speaking'];

@Injectable()
export class TestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------------- Savollar bazasi CRUD (admin) ----------------

  async createTest(actor: AuthUser, dto: CreateTestDto) {
    const test = await this.prisma.test.create({
      data: {
        type: dto.type,
        title: dto.title,
        level: dto.level,
        isDemo: dto.isDemo ?? false,
        durationMinutes: dto.durationMinutes,
        sectionQuestionCounts: dto.sectionQuestionCounts
          ? (dto.sectionQuestionCounts as Prisma.InputJsonValue)
          : undefined,
      },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'test.create',
      entity: 'test',
      entityId: test.id,
      newValue: { title: test.title, type: test.type },
    });
    return test;
  }

  async updateTest(actor: AuthUser, id: string, dto: UpdateTestDto) {
    const test = await this.prisma.test.findUnique({ where: { id } });
    if (!test) throw new AppException('TEST_NOT_FOUND', 'Test topilmadi', 404);
    const updated = await this.prisma.test.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.level !== undefined ? { level: dto.level } : {}),
        ...(dto.isDemo !== undefined ? { isDemo: dto.isDemo } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.durationMinutes !== undefined ? { durationMinutes: dto.durationMinutes } : {}),
        ...(dto.sectionQuestionCounts !== undefined
          ? { sectionQuestionCounts: dto.sectionQuestionCounts as Prisma.InputJsonValue }
          : {}),
      },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'test.update',
      entity: 'test',
      entityId: id,
      newValue: dto as unknown as Record<string, unknown>,
    });
    return updated;
  }

  async addQuestion(actor: AuthUser, testId: string, dto: CreateQuestionDto) {
    const test = await this.prisma.test.findUnique({ where: { id: testId } });
    if (!test) throw new AppException('TEST_NOT_FOUND', 'Test topilmadi', 404);

    const isManual = MANUAL_SECTIONS.includes(dto.section);
    if (!isManual && !dto.correctAnswer) {
      throw new AppException(
        'CORRECT_ANSWER_REQUIRED',
        "Listening/Reading savollari uchun to'g'ri javob majburiy (avtomatik baholash)",
        400,
      );
    }
    if (dto.type === 'multiple_choice' && (!dto.options || dto.options.length < 2)) {
      throw new AppException('OPTIONS_REQUIRED', "Variantlar kamida 2 ta bo'lsin", 400);
    }

    const question = await this.prisma.question.create({
      data: {
        testId,
        section: dto.section,
        type: dto.type,
        prompt: dto.prompt,
        options: dto.options ? (dto.options as Prisma.InputJsonValue) : undefined,
        correctAnswer: dto.correctAnswer,
        maxScore: dto.maxScore ?? 1,
      },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'question.create',
      entity: 'question',
      entityId: question.id,
      newValue: { testId, section: dto.section },
    });
    return question;
  }

  async updateQuestion(actor: AuthUser, questionId: string, dto: UpdateQuestionDto) {
    const question = await this.prisma.question.findUnique({ where: { id: questionId } });
    if (!question) throw new AppException('QUESTION_NOT_FOUND', 'Savol topilmadi', 404);
    const updated = await this.prisma.question.update({
      where: { id: questionId },
      data: {
        ...(dto.section !== undefined ? { section: dto.section } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.prompt !== undefined ? { prompt: dto.prompt } : {}),
        ...(dto.options !== undefined
          ? { options: dto.options as Prisma.InputJsonValue }
          : {}),
        ...(dto.correctAnswer !== undefined ? { correctAnswer: dto.correctAnswer } : {}),
        ...(dto.maxScore !== undefined ? { maxScore: dto.maxScore } : {}),
      },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'question.update',
      entity: 'question',
      entityId: questionId,
      newValue: dto as unknown as Record<string, unknown>,
    });
    return updated;
  }

  async deleteQuestion(actor: AuthUser, questionId: string) {
    const question = await this.prisma.question.findUnique({ where: { id: questionId } });
    if (!question) throw new AppException('QUESTION_NOT_FOUND', 'Savol topilmadi', 404);
    await this.prisma.question.delete({ where: { id: questionId } });
    await this.audit.log({
      userId: actor.id,
      action: 'question.delete',
      entity: 'question',
      entityId: questionId,
      oldValue: { testId: question.testId, prompt: question.prompt },
    });
    return { deleted: true };
  }

  // ---------------- Ro'yxat / tafsilot ----------------

  /** Mehmon va ota-ona faqat demo testlarni ko'radi; xodimlar hammasini */
  async list(viewer: AuthUser | undefined, q: QueryTestsDto) {
    const isStaff =
      viewer && (viewer.role === 'admin' || viewer.role === 'super_admin' || viewer.role === 'teacher');
    const where: Prisma.TestWhereInput = {
      ...(q.type ? { type: q.type } : {}),
      ...(isStaff ? {} : { isActive: true }),
      ...(!viewer || viewer.role === 'parent' ? { isDemo: true } : {}),
    };
    const tests = await this.prisma.test.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { questions: true } } },
    });

    const sections = tests.length
      ? await this.prisma.question.groupBy({
          by: ['testId', 'section'],
          where: { testId: { in: tests.map((t) => t.id) } },
        })
      : [];
    const secMap = new Map<string, TestSection[]>();
    for (const s of sections) {
      const arr = secMap.get(s.testId) ?? [];
      arr.push(s.section);
      secMap.set(s.testId, arr);
    }

    return tests.map((t) => ({
      id: t.id,
      type: t.type,
      title: t.title,
      level: t.level,
      isDemo: t.isDemo,
      isActive: t.isActive,
      durationMinutes: t.durationMinutes,
      questionCount: t._count.questions,
      sections: SECTION_ORDER.filter((s) => (secMap.get(t.id) ?? []).includes(s)),
    }));
  }

  /** Xodimlar savollarni to'liq (javoblari bilan) ko'radi; o'quvchi faqat meta */
  async getOne(viewer: AuthUser, id: string) {
    const test = await this.prisma.test.findUnique({
      where: { id },
      include: { questions: { orderBy: [{ section: 'asc' }, { createdAt: 'asc' }] } },
    });
    if (!test) throw new AppException('TEST_NOT_FOUND', 'Test topilmadi', 404);

    const meta = {
      id: test.id,
      type: test.type,
      title: test.title,
      level: test.level,
      isDemo: test.isDemo,
      isActive: test.isActive,
      durationMinutes: test.durationMinutes,
      sectionQuestionCounts: test.sectionQuestionCounts,
      questionCount: test.questions.length,
    };
    const isStaff =
      viewer.role === 'admin' || viewer.role === 'super_admin' || viewer.role === 'teacher';
    if (!isStaff) return meta;
    return { ...meta, questions: test.questions };
  }

  // ---------------- O'quvchi oqimi ----------------

  /**
   * POST /tests/:id/start — savollar RANDOM tanlanadi va aralashtiriladi
   * (nusxa ko'chirishning oldini olish). Tugallanmagan urinish bo'lsa davom etadi.
   */
  async start(student: AuthUser, testId: string) {
    if (!student.studentProfile) {
      throw new AppException('NOT_A_STUDENT', "Faqat o'quvchi test topshira oladi", 403);
    }
    const test = await this.prisma.test.findUnique({
      where: { id: testId },
      include: { questions: true },
    });
    if (!test || !test.isActive) throw new AppException('TEST_NOT_FOUND', 'Test topilmadi', 404);

    // Resume: tugallanmagan urinish bor bo'lsa, o'sha savollar bilan davom ettiramiz
    const existing = await this.prisma.testAttempt.findFirst({
      where: { studentId: student.id, testId, status: 'in_progress' },
    });
    if (existing) {
      const order = existing.questionOrder as string[];
      const qMap = new Map(test.questions.map((q) => [q.id, q]));
      const questions = order
        .map((qid) => qMap.get(qid))
        .filter((q): q is Question => Boolean(q))
        .map((q) => this.sanitize(q));
      const answers = await this.prisma.answer.findMany({ where: { attemptId: existing.id } });
      return {
        attemptId: existing.id,
        resumed: true,
        durationMinutes: test.durationMinutes,
        startedAt: existing.startedAt,
        questions,
        savedAnswers: Object.fromEntries(answers.map((a) => [a.questionId, a.answer])),
      };
    }

    const counts = (test.sectionQuestionCounts ?? {}) as Record<string, number>;
    const chosen: Question[] = [];
    for (const section of SECTION_ORDER) {
      const pool = test.questions.filter((q) => q.section === section);
      if (pool.length === 0) continue;
      const shuffled = this.shuffle(pool);
      const limit = counts[section];
      const take = limit && limit > 0 ? Math.min(limit, shuffled.length) : shuffled.length;
      chosen.push(...shuffled.slice(0, take));
    }
    if (chosen.length === 0) {
      throw new AppException('TEST_EMPTY', "Bu testda hali savollar yo'q", 400);
    }

    const attempt = await this.prisma.testAttempt.create({
      data: {
        studentId: student.id,
        testId,
        questionOrder: chosen.map((q) => q.id),
      },
    });

    return {
      attemptId: attempt.id,
      resumed: false,
      durationMinutes: test.durationMinutes,
      startedAt: attempt.startedAt,
      questions: chosen.map((q) => this.sanitize(q)),
    };
  }

  /** POST /tests/attempts/:attemptId/answer — javobni saqlash (upsert) */
  async answer(student: AuthUser, attemptId: string, dto: SubmitAnswerDto) {
    const attempt = await this.ownAttempt(student, attemptId);
    if (attempt.status !== 'in_progress') {
      throw new AppException('ATTEMPT_FINISHED', 'Bu urinish allaqachon yakunlangan', 400);
    }
    const order = attempt.questionOrder as string[];
    if (!order.includes(dto.questionId)) {
      throw new AppException('QUESTION_NOT_IN_ATTEMPT', 'Savol bu urinishga tegishli emas', 400);
    }
    await this.prisma.answer.upsert({
      where: { attemptId_questionId: { attemptId, questionId: dto.questionId } },
      update: { answer: dto.answer },
      create: { attemptId, questionId: dto.questionId, answer: dto.answer },
    });
    return { saved: true };
  }

  /** POST /tests/attempts/:attemptId/flag-cheat — tab almashtirish signali */
  async flagCheat(student: AuthUser, attemptId: string, dto: FlagCheatDto) {
    const attempt = await this.ownAttempt(student, attemptId);
    if (attempt.status !== 'in_progress') return { saved: true };
    await this.prisma.$transaction([
      this.prisma.antiCheatEvent.create({ data: { attemptId, event: dto.event } }),
      this.prisma.testAttempt.update({
        where: { id: attemptId },
        data: { antiCheatCount: { increment: 1 } },
      }),
    ]);
    return { saved: true };
  }

  // ---------------- Yordamchilar ----------------

  private async ownAttempt(student: AuthUser, attemptId: string) {
    const attempt = await this.prisma.testAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.studentId !== student.id) {
      throw new AppException('ATTEMPT_NOT_FOUND', 'Urinish topilmadi', 404);
    }
    return attempt;
  }

  /** Kriptografik random bilan aralashtirish (Fisher-Yates) */
  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** O'quvchiga yuboriladigan savol — to'g'ri javobsiz! */
  private sanitize(q: Question) {
    return {
      id: q.id,
      section: q.section,
      type: q.type,
      prompt: q.prompt,
      options: q.options,
      maxScore: q.maxScore,
    };
  }
}
