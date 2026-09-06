import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MockAttemptMode,
  MockAttemptStatus,
  MockQuestionType,
  MockSkill,
  Prisma,
} from '@prisma/client';
import { Request, Response } from 'express';
import { AccessService } from '../common/access.service';
import { AppException } from '../common/app.exception';
import { Paginated } from '../common/pagination';
import { AuthUser } from '../common/types';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../videos/storage.service';
import { GradeMockAnswerDto, ListAttemptsQueryDto } from './dto/mock.dto';
import { MOCK_EXAM_INCLUDE } from './mock-attempt.service';
import { isAnswerCorrect } from './mock-answer';
import { audioContentType, streamFileRange } from './mock-storage';
import {
  AUTO_SKILLS,
  bandFromRaw,
  cefrFromBand,
  cefrFromPercent,
  overallBand as computeOverallBand,
  roundHalfBand,
} from './mock-scoring';

interface SectionAgg {
  skill: MockSkill;
  score: number;
  max: number;
  manual: boolean;
  manualPending: boolean;
  tasks: Array<{ type: MockQuestionType; score: number }>;
}

type RawScores = Record<string, { score: number; max: number }>;
type SectionBands = Record<string, number>;

function isStaff(viewer: AuthUser): boolean {
  return viewer.role === 'teacher' || viewer.role === 'admin' || viewer.role === 'super_admin';
}

@Injectable()
export class MockGradingService {
  private readonly base: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
    config: ConfigService,
  ) {
    this.base = `${config.get<string>('PUBLIC_URL') ?? 'http://localhost:3001'}/v1`;
  }

  /** POST /mock/attempts/:attemptId/submit — avtomatik baholash + band hisoblash */
  async submit(student: AuthUser, attemptId: string) {
    const attempt = await this.prisma.mockAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.studentId !== student.id) {
      throw new AppException('MOCK_ATTEMPT_NOT_FOUND', 'Urinish topilmadi', 404);
    }
    if (attempt.status !== 'in_progress') {
      throw new AppException('MOCK_ATTEMPT_FINISHED', 'Bu urinish allaqachon topshirilgan', 400);
    }
    const result = await this.gradeAndCompute(attemptId, true);
    if (result.status === 'completed') {
      await this.notifyResult(attemptId);
    } else {
      await this.notifyTeacherPending(attemptId);
    }
    return result;
  }

  /** POST /mock/attempts/:attemptId/grade — Writing/Speaking qo'lda baholash */
  async grade(teacher: AuthUser, attemptId: string, dto: GradeMockAnswerDto) {
    const attempt = await this.prisma.mockAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new AppException('MOCK_ATTEMPT_NOT_FOUND', 'Urinish topilmadi', 404);
    if (attempt.status === 'in_progress') {
      throw new AppException('MOCK_ATTEMPT_NOT_SUBMITTED', 'Imtihon hali topshirilmagan', 400);
    }
    await this.access.assertCanViewStudent(teacher, attempt.studentId);

    const question = await this.prisma.mockQuestion.findFirst({
      where: { id: dto.questionId, group: { section: { examId: attempt.examId } } },
      include: { group: { include: { section: { select: { skill: true } } } } },
    });
    if (!question) {
      throw new AppException('QUESTION_NOT_IN_EXAM', 'Savol bu imtihonga tegishli emas', 400);
    }
    if (AUTO_SKILLS.includes(question.group.section.skill)) {
      throw new AppException('NOT_MANUAL_QUESTION', 'Bu savol avtomatik baholanadi', 400);
    }
    if (dto.score > question.points) {
      throw new AppException(
        'SCORE_OUT_OF_RANGE',
        `Ball 0 dan ${question.points} gacha bo'lishi kerak`,
        400,
      );
    }

    await this.prisma.mockAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId: dto.questionId } },
      update: {
        score: dto.score,
        isGraded: true,
        gradedById: teacher.id,
        feedback: dto.feedback ?? null,
        rubricScores: (dto.rubricScores ?? null) as unknown as Prisma.InputJsonValue,
      },
      create: {
        attemptId,
        questionId: dto.questionId,
        response: '',
        score: dto.score,
        isGraded: true,
        gradedById: teacher.id,
        feedback: dto.feedback,
        rubricScores: (dto.rubricScores ?? null) as unknown as Prisma.InputJsonValue,
      },
    });

    const result = await this.gradeAndCompute(attemptId, false);
    if (result.status === 'completed') await this.notifyResult(attemptId);
    return { saved: true, status: result.status };
  }

  /**
   * Auto savollarni baholaydi, bo'lim bo'yicha xom ball va IELTS band /
   * Multilevel CEFR ni hisoblab saqlaydi. Manual savol qolgan bo'lsa — "grading".
   */
  private async gradeAndCompute(attemptId: string, markSubmitted: boolean) {
    const attempt = await this.prisma.mockAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: { include: MOCK_EXAM_INCLUDE }, answers: true },
    });
    if (!attempt) throw new AppException('MOCK_ATTEMPT_NOT_FOUND', 'Urinish topilmadi', 404);

    const answerByQ = new Map(attempt.answers.map((a) => [a.questionId, a]));
    const examType = attempt.exam.type;
    const isIelts = examType === 'ielts_academic' || examType === 'ielts_general';
    const updates: Prisma.PrismaPromise<unknown>[] = [];
    const aggs: SectionAgg[] = [];

    for (const section of attempt.exam.sections) {
      const auto = AUTO_SKILLS.includes(section.skill);
      const agg: SectionAgg = {
        skill: section.skill,
        score: 0,
        max: 0,
        manual: !auto,
        manualPending: false,
        tasks: [],
      };
      for (const group of section.groups) {
        for (const q of group.questions) {
          agg.max += q.points;
          const ans = answerByQ.get(q.id);
          if (auto) {
            const key = (q.correctAnswers as string[] | null) ?? [];
            // Spec §3: wordLimit (NO MORE THAN X) + Br/Am acceptedVariants.
            const wordLimit = (q as { wordLimit?: number | null }).wordLimit ?? null;
            const acceptedVariants = (q as { acceptedVariants?: string[] | null }).acceptedVariants ?? null;
            const correct = ans
              ? isAnswerCorrect(q.type, ans.response, key, { wordLimit, acceptedVariants })
              : false;
            const s = correct ? q.points : 0;
            agg.score += s;
            if (ans) {
              updates.push(
                this.prisma.mockAnswer.update({
                  where: { id: ans.id },
                  data: { isCorrect: correct, score: s, isGraded: true },
                }),
              );
            }
          } else if (ans && ans.isGraded) {
            agg.score += ans.score ?? 0;
            agg.tasks.push({ type: q.type, score: ans.score ?? 0 });
          } else {
            agg.manualPending = true;
          }
        }
      }
      aggs.push(agg);
    }

    const manualPending = aggs.some((a) => a.manual && a.manualPending);

    const rawScores: RawScores = {};
    for (const a of aggs) rawScores[a.skill] = { score: a.score, max: a.max };

    let sectionBands: SectionBands | null = null;
    let overall: number | null = null;
    let cefrLevel: string | null = null;

    if (isIelts) {
      const bands: SectionBands = {};
      for (const a of aggs) {
        if (a.max === 0) continue;
        if (!a.manual) {
          bands[a.skill] = bandFromRaw(a.skill, examType, a.score, a.max);
        } else if (!a.manualPending) {
          bands[a.skill] = this.manualSectionBand(a.skill, a.tasks);
        }
      }
      sectionBands = bands;
      if (!manualPending) {
        // Spec §5: full_test da maxraj har doim 4 (bo'lim yetishmasa ham).
        const isFullTest = (attempt as { flowMode?: string | null }).flowMode === 'full_test';
        overall = computeOverallBand(Object.values(bands), isFullTest ? { fixedDivisor: 4 } : {});
        if (overall !== null) cefrLevel = cefrFromBand(overall);
      }
    } else if (!manualPending) {
      const totalScore = aggs.reduce((s, a) => s + a.score, 0);
      const totalMax = aggs.reduce((s, a) => s + a.max, 0);
      cefrLevel = cefrFromPercent(totalMax > 0 ? (totalScore / totalMax) * 100 : 0);
    }

    const status: MockAttemptStatus = manualPending ? 'grading' : 'completed';
    updates.push(
      this.prisma.mockAttempt.update({
        where: { id: attemptId },
        data: {
          status,
          rawScores: rawScores as Prisma.InputJsonValue,
          sectionBands: sectionBands ? (sectionBands as Prisma.InputJsonValue) : Prisma.JsonNull,
          overallBand: overall,
          cefrLevel,
          ...(markSubmitted ? { submittedAt: new Date() } : {}),
          finishedAt: status === 'completed' ? new Date() : null,
        },
      }),
    );

    await this.prisma.$transaction(updates);
    return { status, rawScores, sectionBands, overallBand: overall, cefrLevel };
  }

  /** Writing: Task 2 ikki barobar; Speaking: o'rtacha. Natija 0.5 ga yaxlitlanadi. */
  private manualSectionBand(
    skill: MockSkill,
    tasks: Array<{ type: MockQuestionType; score: number }>,
  ): number {
    if (tasks.length === 0) return 0;
    if (skill === 'writing') {
      const t1 = tasks.find((t) => t.type === 'essay_task1')?.score;
      const t2 = tasks.find((t) => t.type === 'essay_task2')?.score;
      if (t1 !== undefined && t2 !== undefined) return roundHalfBand((t1 + 2 * t2) / 3);
    }
    const avg = tasks.reduce((s, t) => s + t.score, 0) / tasks.length;
    return roundHalfBand(avg);
  }

  // ─────────────────────────── Ro'yxat / tafsilot ───────────────────────────

  async listAttempts(viewer: AuthUser, q: ListAttemptsQueryDto) {
    const where: Prisma.MockAttemptWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.examId ? { examId: q.examId } : {}),
      ...(q.studentId ? { studentId: q.studentId } : {}),
    };
    if (viewer.role === 'teacher') {
      where.student = { group: { teacherId: viewer.id } };
    }
    const [total, rows] = await Promise.all([
      this.prisma.mockAttempt.count({ where }),
      this.prisma.mockAttempt.findMany({
        where,
        include: {
          student: { include: { user: { select: { name: true } } } },
          exam: { select: { title: true, type: true } },
        },
        orderBy: { startedAt: 'desc' },
        skip: q.skip,
        take: q.limit,
      }),
    ]);
    return new Paginated(
      rows.map((a) => this.summary(a)),
      { page: q.page, limit: q.limit, total },
    );
  }

  async myAttempts(student: AuthUser, q: ListAttemptsQueryDto) {
    const where: Prisma.MockAttemptWhereInput = {
      studentId: student.id,
      ...(q.status ? { status: q.status } : {}),
      ...(q.examId ? { examId: q.examId } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.mockAttempt.count({ where }),
      this.prisma.mockAttempt.findMany({
        where,
        include: { exam: { select: { title: true, type: true } } },
        orderBy: { startedAt: 'desc' },
        skip: q.skip,
        take: q.limit,
      }),
    ]);
    return new Paginated(
      rows.map((a) => this.summary(a)),
      { page: q.page, limit: q.limit, total },
    );
  }

  async getAttempt(viewer: AuthUser, attemptId: string) {
    const attempt = await this.prisma.mockAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: { include: MOCK_EXAM_INCLUDE },
        answers: true,
        cheatEvents: { orderBy: { createdAt: 'asc' } },
        student: { include: { user: { select: { name: true } } } },
      },
    });
    if (!attempt) throw new AppException('MOCK_ATTEMPT_NOT_FOUND', 'Urinish topilmadi', 404);
    await this.access.assertCanViewStudent(viewer, attempt.studentId);

    const staff = isStaff(viewer);
    // O'quvchi urinish tugagach o'z to'g'ri javoblarini ko'radi (mashq uchun)
    const showAnswers = staff || attempt.status === 'completed';
    const answerByQ = new Map(attempt.answers.map((a) => [a.questionId, a]));
    const rawScores = (attempt.rawScores as RawScores | null) ?? {};
    const sectionBands = (attempt.sectionBands as SectionBands | null) ?? {};

    const sections = attempt.exam.sections.map((s) => ({
      id: s.id,
      skill: s.skill,
      title: s.title,
      durationMinutes: s.durationMinutes,
      instructions: s.instructions,
      score: rawScores[s.skill]?.score ?? null,
      max: rawScores[s.skill]?.max ?? null,
      band: sectionBands[s.skill] ?? null,
      groups: s.groups.map((g) => ({
        id: g.id,
        title: g.title,
        instructions: g.instructions,
        passageText: g.passageText,
        hasAudio: !!g.audioKey,
        questions: g.questions.map((qq) => {
          const ans = answerByQ.get(qq.id);
          return {
            id: qq.id,
            number: qq.number,
            type: qq.type,
            prompt: qq.prompt,
            options: (qq.options as string[] | null) ?? null,
            points: qq.points,
            wordLimit: qq.wordLimit,
            response: ans?.response ?? null,
            hasAudio: !!ans?.audioKey,
            audioUrl: ans?.audioKey
              ? `${this.base}/mock/attempts/${attemptId}/answers/${qq.id}/audio`
              : null,
            score: ans?.score ?? null,
            isCorrect: ans?.isCorrect ?? null,
            isGraded: ans?.isGraded ?? false,
            feedback: ans?.feedback ?? null,
            rubricScores: (ans as { rubricScores?: unknown } | undefined)?.rubricScores ?? null,
            ...(showAnswers ? { correctAnswers: (qq.correctAnswers as string[] | null) ?? null } : {}),
          };
        }),
      })),
    }));

    return {
      ...this.summary(attempt),
      annotations: attempt.annotations ?? [],
      sections,
      ...(staff
        ? { cheatEvents: attempt.cheatEvents.map((e) => ({ event: e.event, date: e.createdAt })) }
        : {}),
    };
  }

  /** GET /mock/attempts/:attemptId/answers/:questionId/audio — Speaking javob audiosi */
  async streamSpeakingAudio(
    viewer: AuthUser,
    attemptId: string,
    questionId: string,
    req: Request,
    res: Response,
  ) {
    const attempt = await this.prisma.mockAttempt.findUnique({
      where: { id: attemptId },
      select: { studentId: true },
    });
    if (!attempt) throw new AppException('MOCK_ATTEMPT_NOT_FOUND', 'Urinish topilmadi', 404);
    await this.access.assertCanViewStudent(viewer, attempt.studentId);

    const answer = await this.prisma.mockAnswer.findUnique({
      where: { attemptId_questionId: { attemptId, questionId } },
      select: { audioKey: true },
    });
    if (!answer?.audioKey || !this.storage.exists(answer.audioKey)) {
      throw new AppException('FILE_NOT_FOUND', 'Audio topilmadi', 404);
    }
    streamFileRange(this.storage, answer.audioKey, audioContentType(answer.audioKey), req, res);
  }

  /** Sertifikat uchun ma'lumot */
  async certificateData(viewer: AuthUser, attemptId: string) {
    const attempt = await this.prisma.mockAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: { select: { title: true, type: true, level: true } },
        student: { include: { user: { select: { name: true } } } },
      },
    });
    if (!attempt) throw new AppException('MOCK_ATTEMPT_NOT_FOUND', 'Urinish topilmadi', 404);
    await this.access.assertCanViewStudent(viewer, attempt.studentId);
    if (attempt.status !== 'completed') {
      throw new AppException('MOCK_ATTEMPT_NOT_COMPLETED', 'Natija hali tayyor emas', 400);
    }
    const rawScores = (attempt.rawScores as RawScores | null) ?? {};
    const sectionBands = (attempt.sectionBands as SectionBands | null) ?? {};
    const order: MockSkill[] = ['listening', 'reading', 'writing', 'speaking'];
    const sections = order
      .filter((skill) => rawScores[skill])
      .map((skill) => ({
        skill,
        score: rawScores[skill].score,
        max: rawScores[skill].max,
        band: sectionBands[skill] ?? null,
      }));

    return {
      studentName: attempt.student.user.name,
      examTitle: attempt.exam.title,
      examType: attempt.exam.type,
      level: attempt.exam.level,
      isIelts: attempt.exam.type !== 'multilevel',
      finishedAt: attempt.finishedAt ?? new Date(),
      attemptId: attempt.id,
      sections,
      overallBand: attempt.overallBand,
      cefrLevel: attempt.cefrLevel,
    };
  }

  // ─────────────────────────── Helpers ───────────────────────────

  private summary(a: {
    id: string;
    examId: string;
    studentId: string;
    status: MockAttemptStatus;
    mode: MockAttemptMode;
    deadlineAt: Date | null;
    rawScores: Prisma.JsonValue;
    sectionBands: Prisma.JsonValue;
    overallBand: number | null;
    cefrLevel: string | null;
    antiCheatCount: number;
    startedAt: Date;
    submittedAt: Date | null;
    finishedAt: Date | null;
    flowMode?: string | null;
    currentSkill?: unknown;
    sectionDeadlines?: Prisma.JsonValue;
    overallDeadlineAt?: Date | null;
    exam?: { title: string; type: string } | null;
    student?: { user: { name: string } } | null;
  }) {
    return {
      id: a.id,
      examId: a.examId,
      examTitle: a.exam?.title,
      examType: a.exam?.type,
      studentId: a.studentId,
      studentName: a.student?.user.name,
      status: a.status,
      mode: a.mode,
      deadlineAt: (a.overallDeadlineAt ?? a.deadlineAt) as Date | null,
      flowMode: (a.flowMode ?? 'single_skill') as string,
      currentSkill: (a.currentSkill ?? null) as unknown,
      sectionDeadlines: (a.sectionDeadlines ?? null) as Prisma.JsonValue,
      overallDeadlineAt: (a.overallDeadlineAt ?? null) as Date | null,
      rawScores: a.rawScores ?? null,
      sectionBands: a.sectionBands ?? null,
      overallBand: a.overallBand,
      cefrLevel: a.cefrLevel,
      antiCheatCount: a.antiCheatCount,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt,
      finishedAt: a.finishedAt,
    };
  }

  private async notifyResult(attemptId: string): Promise<void> {
    const attempt = await this.prisma.mockAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: { select: { title: true, type: true } } },
    });
    if (!attempt) return;
    const headline =
      attempt.exam.type === 'multilevel'
        ? `daraja: ${attempt.cefrLevel ?? '—'}`
        : `Overall Band: ${attempt.overallBand ?? '—'}`;
    await this.notifications.notify(
      attempt.studentId,
      'test_result',
      `Mock imtihon natijangiz tayyor: "${attempt.exam.title}" — ${headline}.`,
    );
    await this.notifications.notifyParents(
      attempt.studentId,
      'test_result',
      `Farzandingizning "${attempt.exam.title}" mock natijasi: ${headline}.`,
    );
  }

  private async notifyTeacherPending(attemptId: string): Promise<void> {
    const attempt = await this.prisma.mockAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: { select: { title: true } },
        student: {
          include: { group: { select: { teacherId: true } }, user: { select: { name: true } } },
        },
      },
    });
    if (!attempt?.student.group?.teacherId) return;
    await this.notifications.notify(
      attempt.student.group.teacherId,
      'test_result',
      `${attempt.student.user.name} "${attempt.exam.title}" mock imtihonini topshirdi — Writing/Speaking baholashingiz kutilmoqda.`,
    );
  }
}
