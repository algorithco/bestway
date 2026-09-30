import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MockAnswer, MockAttempt, Prisma } from '@prisma/client';
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
import { ExamRow, SKILL_ORDER, computeSkillTiming, shapeExam, totalDuration } from './mock-shape';

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

const CHEAT_EVENT_CAP = 50;

type SectionDeadlines = Partial<Record<'listening' | 'reading' | 'writing' | 'speaking', string>>;

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
      return this.resumeResponse(existing, shaped, totalDuration(exam as unknown as ExamRow));
    }

    // --- IELTS full-test flow (v2026.1; qarorlar: dynamic audio+2min, practice=lenient, exam=strict) ---
    // Full-test flow faqat full_mock profildagi imtihonlarda — single-skill
    // practice testlarga full-test timing/transition majburan qo'llanmaydi.
    const flowMode = dto.flow === 'full_test' ? 'full_test' : 'single_skill';
    if (flowMode === 'full_test') {
      if ((exam as unknown as { profile?: string }).profile !== 'full_mock') {
        throw new AppException(
          'MOCK_FULL_TEST_UNAVAILABLE',
          'Full Mock flow faqat full_mock imtihonlarda mavjud',
          400,
        );
      }
      return this.startFullTest(student, examId, exam as unknown as ExamRow, shaped);
    }

    const mode = dto.mode ?? 'practice';
    // Single_skill timed: skill-aware deadline (IELTS qoidalari).
    // listening = audio yig'indisi + 120s review, reading/writing = durationMinutes,
    // speaking = deadline'siz. `totalDuration` faqat ko'rinish (display) uchun.
    const duration = totalDuration(exam as unknown as ExamRow);
    let deadlineAt: Date | null = null;
    let overallDeadlineAt: Date | null = null;
    let sectionDeadlines: SectionDeadlines | null = null;
    if (mode === 'timed') {
      const now = Date.now();
      const bySkill = new Map((exam.sections ?? []).map((s) => [s.skill, s]));
      const map: SectionDeadlines = {};
      let last: Date | null = null;
      for (const skill of SKILL_ORDER) {
        const section = bySkill.get(skill);
        if (!section) continue;
        const { deadline } = computeSkillTiming(skill, section, now);
        if (!deadline) continue; // speaking — deadline yo'q
        if (skill !== 'speaking') {
          map[skill as keyof SectionDeadlines] = deadline.toISOString();
        }
        last = deadline;
      }
      if (last) {
        deadlineAt = last;
        overallDeadlineAt = last;
        sectionDeadlines = map;
      }
      // Faqat speaking'dan iborat exam timed bo'lsa ham — deadline null.
    }

    let attempt: MockAttempt;
    try {
      attempt = await this.prisma.mockAttempt.create({
        data: {
          examId,
          studentId: student.id,
          mode,
          deadlineAt,
          ...(sectionDeadlines ? { sectionDeadlines: sectionDeadlines as unknown as Prisma.InputJsonValue } : {}),
          ...(overallDeadlineAt ? { overallDeadlineAt } : {}),
        },
      });
    } catch (err) {
      const raced = await this.prisma.mockAttempt.findFirst({
        where: { studentId: student.id, examId, status: 'in_progress' },
        include: { answers: true },
      });
      if (!raced) throw err;
      return this.resumeResponse(raced, shaped, duration);
    }
    return {
      attemptId: attempt.id,
      resumed: false,
      mode: attempt.mode,
      startedAt: attempt.startedAt,
      deadlineAt: attempt.deadlineAt,
      serverTime: new Date(),
      durationMinutes: duration,
      flowMode: attempt.flowMode ?? 'single_skill',
      currentSkill: attempt.currentSkill ?? null,
      sectionDeadlines: attempt.sectionDeadlines ?? null,
      overallDeadlineAt: attempt.overallDeadlineAt ?? null,
      exam: shaped,
      annotations: [],
      savedAnswers: {},
    };
  }

  /**
   * Full-test start (exam, strict): L→R→W→S ketma-ket, server-soat.
   * Har bir skill deadline `computeSkillTiming` bilan (listening = audio+120s
   * review, reading/writing = durationMinutes), zanjir ketma-ket ulanadi.
   * Practice dan farqli — mode har doim timed, currentSkill=listening.
   */
  private async startFullTest(student: AuthUser, examId: string, exam: ExamRow, shaped: ReturnType<typeof shapeExam>) {
    const now = Date.now();
    const sections = exam.sections ?? [];
    const bySkill = new Map(sections.map((s) => [s.skill, s]));
    // Speaking has no time box (see startFullTest docstring): no per-section
    // deadline key and no overall deadline, otherwise the unconditional
    // overall check in assertNotTimedOut would MOCK_TIME_UP every speaking
    // action once writing's clock runs out.
    const hasSpeaking = bySkill.has('speaking' as never);

    // Zanjirli deadline: har bir bo'lim oldingisi tugagach boshlanadi.
    let cursor = now;
    const sectionDeadlines: SectionDeadlines = {};
    for (const skill of ['listening', 'reading', 'writing'] as const) {
      const { seconds } = computeSkillTiming(skill, bySkill.get(skill), cursor);
      if (seconds == null) continue;
      cursor += seconds * 1000;
      sectionDeadlines[skill] = new Date(cursor).toISOString();
    }
    const writingDeadline = new Date(cursor);
    // Speaking is untimed: no overall deadline, otherwise the unconditional
    // overall check in assertNotTimedOut would MOCK_TIME_UP every speaking
    // action once writing's clock runs out. Per-skill sectionDeadlines alone
    // guard L/R/W; the speaking key is simply omitted (missing key tolerated).
    const overallDeadline: Date | null = hasSpeaking ? null : writingDeadline;

    let attempt: MockAttempt;
    try {
      attempt = await this.prisma.mockAttempt.create({
        data: {
          examId,
          studentId: student.id,
          mode: 'timed',
          deadlineAt: overallDeadline,
          flowMode: 'full_test',
          currentSkill: 'listening',
          sectionDeadlines: sectionDeadlines as unknown as Prisma.InputJsonValue,
          overallDeadlineAt: overallDeadline,
          audioPlays: {} as unknown as Prisma.InputJsonValue,
          submittedSections: [] as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      const raced = await this.prisma.mockAttempt.findFirst({
        where: { studentId: student.id, examId, status: 'in_progress' },
        include: { answers: true },
      });
      if (!raced) throw err;
      return this.resumeResponse(raced, shaped, totalDuration(exam));
    }
    return {
      attemptId: attempt.id,
      resumed: false,
      mode: attempt.mode,
      startedAt: attempt.startedAt,
      deadlineAt: attempt.deadlineAt,
      serverTime: new Date(),
      durationMinutes: Math.round((writingDeadline.getTime() - now) / 60_000),
      flowMode: 'full_test' as const,
      currentSkill: 'listening' as const,
      sectionDeadlines,
      overallDeadlineAt: overallDeadline,
      exam: shaped,
      annotations: [],
      savedAnswers: {},
    };
  }

  /**
   * Full-test advance: joriy bo'limni yakunlab keyingisiga o'tish (L→R→W→S).
   * Server-soat asosida; orqaga qaytish yo'q (exam strict, qaror #4).
   * Speaking faqat imtihonda speaking bo'limi bo'lsa ro'yxatda bo'ladi —
   * bo'lmasa writing oxirgi bo'lib qoladi. Oxirgi bo'limdan keyin advance
   * FLOW_COMPLETE beradi (yakunlash submit orqali).
   */
  async advanceSection(student: AuthUser, attemptId: string) {
    const attempt = await this.ownAttempt(student, attemptId);
    this.assertInProgress(attempt.status);
    if (attempt.flowMode !== 'full_test') {
      throw new AppException('NOT_FULL_TEST', 'Bu urinish full_test rejimida emas', 400);
    }
    const skills = await this.prisma.mockSection.findMany({
      where: { examId: attempt.examId },
      select: { skill: true },
    });
    const base = ['listening', 'reading', 'writing'] as const;
    type FlowSkill = (typeof base)[number] | 'speaking';
    const order: readonly FlowSkill[] = skills.some((s) => s.skill === 'speaking')
      ? [...base, 'speaking']
      : base;
    const current = attempt.currentSkill as FlowSkill | null;
    const idx = current ? order.indexOf(current) : -1;
    if (idx === -1 || idx >= order.length - 1) {
      throw new AppException('FLOW_COMPLETE', 'Oxirgi bo‘limdasiz — imtihonni yakunlang', 400);
    }
    const submitted = Array.isArray(attempt.submittedSections) ? [...(attempt.submittedSections as string[])] : [];
    if (current && !submitted.includes(current)) submitted.push(current);
    const next = order[idx + 1];
    const updated = await this.prisma.mockAttempt.update({
      where: { id: attemptId },
      data: {
        currentSkill: next,
        submittedSections: submitted as unknown as Prisma.InputJsonValue,
        // Entering speaking clears any overall deadline (heals attempts
        // started before overallDeadlineAt=null; speaking is untimed).
        ...(next === 'speaking' ? { overallDeadlineAt: null, deadlineAt: null } : {}),
      },
    });
    return {
      saved: true,
      currentSkill: updated.currentSkill,
      submittedSections: submitted,
      serverTime: new Date(),
      sectionDeadlines: updated.sectionDeadlines,
      overallDeadlineAt: updated.overallDeadlineAt,
    };
  }

  /**
   * Listening once-only nazorati (spec §2.1; qaror #4: practice=cheksiz, timed=1 marta).
   * Timed rejimda full_test VA single_skill listening'da qo'llanadi.
   * Audio stream dan oldin chaqiriladi. Qayta urinish → 403 AUDIO_REPLAY_BLOCKED.
   */
  async recordAudioPlay(student: AuthUser | undefined, attemptId: string | undefined, groupId: string) {
    if (!attemptId || !student) return { allowed: true, plays: 0, limited: false };
    const attempt = await this.prisma.mockAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.studentId !== student.id) return { allowed: true, plays: 0, limited: false };
    if (attempt.mode !== 'timed') {
      return { allowed: true, plays: 0, limited: false };
    }
    const group = await this.prisma.mockQuestionGroup.findUnique({
      where: { id: groupId },
      select: { id: true, audioKey: true, audioPlayLimit: true, section: { select: { skill: true } } },
    });
    if (!group || group.section.skill !== 'listening' || !group.audioKey) {
      return { allowed: true, plays: 0, limited: false };
    }
    const plays = ((attempt.audioPlays as Record<string, number> | null) ?? {}) as Record<string, number>;
    const count = (plays[groupId] ?? 0) + 1;
    if (count > group.audioPlayLimit) {
      throw new AppException('AUDIO_REPLAY_BLOCKED', 'Audio bir marta eshitiladi (exam rejimi)', 403);
    }
    await this.prisma.mockAttempt.update({
      where: { id: attemptId },
      data: { audioPlays: { ...plays, [groupId]: count } as unknown as Prisma.InputJsonValue },
    });
    return { allowed: true, plays: count, limited: true };
  }

  private resumeResponse(
    attempt: MockAttempt & { answers: MockAnswer[] },
    exam: ReturnType<typeof shapeExam>,
    durationMinutes: number | null,
  ) {
    return {
      attemptId: attempt.id,
      resumed: true,
      mode: attempt.mode,
      startedAt: attempt.startedAt,
      deadlineAt: attempt.overallDeadlineAt ?? attempt.deadlineAt,
      serverTime: new Date(),
      durationMinutes,
      flowMode: attempt.flowMode ?? 'single_skill',
      currentSkill: attempt.currentSkill ?? null,
      sectionDeadlines: attempt.sectionDeadlines ?? null,
      overallDeadlineAt: attempt.overallDeadlineAt ?? null,
      exam,
      annotations: attempt.annotations ?? [],
      savedAnswers: Object.fromEntries(
        attempt.answers.map((a) => [a.questionId, a.audioKey ? '[audio]' : a.response]),
      ),
    };
  }

  /** POST /mock/attempts/:attemptId/answer — bitta javobni saqlash (upsert) */
  async saveAnswer(student: AuthUser, attemptId: string, dto: SaveAnswerDto) {
    const attempt = await this.ownAttempt(student, attemptId);
    this.assertInProgress(attempt.status);
    this.assertNotTimedOut(attempt);
    await this.assertQuestionInExam(attempt.examId, dto.questionId);
    await this.assertQuestionInCurrentSection(attempt.examId, dto.questionId, attempt);
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
      select: { id: true, group: { select: { section: { select: { skill: true } } } } },
    });
    // Full-test strict: faqat joriy bo'lim savollari qabul qilinadi (qaror #4).
    const inSection = attempt.flowMode === 'full_test' && attempt.currentSkill
      ? valid.filter((v) => v.group.section.skill === attempt.currentSkill)
      : valid;
    const validIds = new Set(inSection.map((v) => v.id));
    const items = dto.answers.filter((a) => validIds.has(a.questionId));
    if (items.length === 0) {
      throw new AppException(
        attempt.flowMode === 'full_test' ? 'SECTION_LOCKED' : 'QUESTION_NOT_IN_EXAM',
        attempt.flowMode === 'full_test' ? 'Hozir faqat joriy bo‘limga javob beriladi' : 'Javoblar bu imtihonga tegishli emas',
        attempt.flowMode === 'full_test' ? 403 : 400,
      );
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
    await this.prisma.mockAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      update: { audioKey: key },
      create: { attemptId, questionId, response: '', audioKey: key },
    });
    if (existing?.audioKey && existing.audioKey !== key) {
      this.storage.delete(existing.audioKey);
    }
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
    const count = await this.prisma.mockCheatEvent.count({ where: { attemptId } });
    if (count >= CHEAT_EVENT_CAP) return { saved: true };
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
    const now = Date.now();
    const overall = attempt.overallDeadlineAt ?? attempt.deadlineAt;
    if (attempt.mode === 'timed' && overall && now > overall.getTime()) {
      throw new AppException('MOCK_TIME_UP', 'Vaqt tugadi — imtihonni yakunlang', 400);
    }
    // Joriy bo'lim deadline (currentSkill o'rnatilgan bo'lsa — flowMode dan
    // qat'iy nazar; single_skill urinishlarda currentSkill null bo'ladi va
    // umumiy deadlineAt tekshiruvi yuqorida ishlaydi; eski urinishlar ham
    // shu fallback orqali buzilmasdan ishlaydi).
    if (attempt.currentSkill) {
      const deadlines = (attempt.sectionDeadlines as SectionDeadlines | null) ?? null;
      const iso = deadlines?.[attempt.currentSkill as keyof SectionDeadlines];
      if (iso && now > new Date(iso).getTime()) {
        throw new AppException('MOCK_SECTION_TIME_UP', 'Bo‘lim vaqti tugadi — keyingi bo‘limga o‘ting', 400);
      }
    } else if (attempt.mode === 'timed' && attempt.deadlineAt && now > attempt.deadlineAt.getTime()) {
      throw new AppException('MOCK_TIME_UP', 'Vaqt tugadi — imtihonni yakunlang', 400);
    }
  }

  /** Full-test strict: faqat joriy bo'lim savollariga javob (orqaga/oldinga yo'q, qaror #4). */
  private async assertQuestionInCurrentSection(examId: string, questionId: string, attempt: MockAttempt): Promise<void> {
    if (attempt.flowMode !== 'full_test' || !attempt.currentSkill) return;
    const q = await this.prisma.mockQuestion.findFirst({
      where: { id: questionId, group: { section: { examId } } },
      select: { group: { select: { section: { select: { skill: true } } } } },
    });
    if (!q) {
      throw new AppException('QUESTION_NOT_IN_EXAM', 'Savol bu imtihonga tegishli emas', 400);
    }
    if (q.group.section.skill !== attempt.currentSkill) {
      throw new AppException('SECTION_LOCKED', 'Hozir faqat joriy bo‘limga javob beriladi', 403);
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
