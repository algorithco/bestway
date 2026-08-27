import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MockExamType, MockQuestionType, Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/app.exception';
import { AuthUser } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../videos/storage.service';
import {
  AddQuestionsDto,
  CreateGroupDto,
  CreateMockExamDto,
  CreateSectionDto,
  ImportQuestionsDto,
  ListExamsQueryDto,
  UpdateGroupDto,
  UpdateMockExamDto,
  UpdateQuestionDto,
  UpdateSectionDto,
} from './dto/mock.dto';
import { MockAccessService } from './mock-access.service';
import { buildCorrectAnswers, parseQuestions } from './mock-parse';
import { audioContentType } from './mock-storage';
import { AUTO_SKILLS } from './mock-scoring';
import { ExamRow, shapeExam, shapeExamMeta } from './mock-shape';

/** Variantlar (options) majburiy bo'lgan savol turlari */
const OPTION_TYPES = new Set<MockQuestionType>([
  'multiple_choice',
  'multi_select',
  'matching',
  'matching_headings',
]);

const IELTS_MANUAL_POINTS = 9;

const EXAM_INCLUDE = {
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

function isStaff(viewer?: AuthUser): boolean {
  return (
    !!viewer &&
    (viewer.role === 'admin' || viewer.role === 'super_admin' || viewer.role === 'teacher')
  );
}

@Injectable()
export class MockAuthoringService {
  private readonly base: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly accessSvc: MockAccessService,
    config: ConfigService,
  ) {
    this.base = `${config.get<string>('PUBLIC_URL') ?? 'http://localhost:3001'}/v1`;
  }

  // ─────────────────────────── Exam ───────────────────────────

  async createExam(actor: AuthUser, dto: CreateMockExamDto) {
    const exam = await this.prisma.mockExam.create({
      data: {
        type: dto.type,
        title: dto.title,
        description: dto.description,
        level: dto.level,
        isDemo: dto.isDemo ?? false,
        price: dto.price ?? 0,
        isFreeForApproved: dto.isFreeForApproved ?? true,
        createdById: actor.id,
      },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'mock.exam.create',
      entity: 'mockExam',
      entityId: exam.id,
      newValue: { title: exam.title, type: exam.type },
    });
    return exam;
  }

  async updateExam(actor: AuthUser, id: string, dto: UpdateMockExamDto) {
    await this.examOrThrow(id);
    const updated = await this.prisma.mockExam.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.level !== undefined ? { level: dto.level } : {}),
        ...(dto.isPublished !== undefined ? { isPublished: dto.isPublished } : {}),
        ...(dto.isDemo !== undefined ? { isDemo: dto.isDemo } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.isFreeForApproved !== undefined
          ? { isFreeForApproved: dto.isFreeForApproved }
          : {}),
      },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'mock.exam.update',
      entity: 'mockExam',
      entityId: id,
      newValue: dto as unknown as Record<string, unknown>,
    });
    return updated;
  }

  async deleteExam(actor: AuthUser, id: string) {
    const exam = await this.prisma.mockExam.findUnique({
      where: { id },
      include: { sections: { include: { groups: true } } },
    });
    if (!exam) throw new AppException('MOCK_EXAM_NOT_FOUND', 'Mock imtihon topilmadi', 404);
    // Media fayllarni tozalash
    for (const s of exam.sections) {
      for (const g of s.groups) {
        if (g.audioKey) this.storage.delete(g.audioKey);
        if (g.imageKey) this.storage.delete(g.imageKey);
      }
    }
    await this.prisma.mockExam.delete({ where: { id } });
    await this.audit.log({
      userId: actor.id,
      action: 'mock.exam.delete',
      entity: 'mockExam',
      entityId: id,
      oldValue: { title: exam.title },
    });
    return { deleted: true };
  }

  async listExams(viewer: AuthUser | undefined, q: ListExamsQueryDto) {
    const staff = isStaff(viewer);
    const where: Prisma.MockExamWhereInput = {
      ...(q.type ? { type: q.type } : {}),
    };
    if (!staff) {
      if (viewer?.role === 'student') {
        where.OR = [{ isPublished: true }, { isDemo: true }];
      } else {
        where.isDemo = true; // mehmon / ota-ona
      }
    }
    const exams = await this.prisma.mockExam.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        sections: {
          orderBy: { sortOrder: 'asc' },
          select: {
            skill: true,
            durationMinutes: true,
            groups: { select: { _count: { select: { questions: true } } } },
          },
        },
      },
    });
    const accessMap = await this.accessSvc.annotateAccess(
      viewer,
      exams.map((e) => ({
        id: e.id,
        isDemo: e.isDemo,
        isPublished: e.isPublished,
        price: e.price,
        isFreeForApproved: e.isFreeForApproved,
      })),
    );
    return exams.map((e) => {
      const questionCount = e.sections.reduce(
        (sum, s) => sum + s.groups.reduce((gs, g) => gs + g._count.questions, 0),
        0,
      );
      const duration = e.sections.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);
      return {
        id: e.id,
        type: e.type,
        title: e.title,
        description: e.description,
        level: e.level,
        isDemo: e.isDemo,
        isPublished: e.isPublished,
        skills: e.sections.map((s) => s.skill),
        questionCount,
        durationMinutes: duration > 0 ? duration : null,
        price: e.price,
        access: accessMap.get(e.id) ?? 'locked',
      };
    });
  }

  async getExam(viewer: AuthUser | undefined, id: string) {
    const exam = await this.prisma.mockExam.findUnique({ where: { id }, include: EXAM_INCLUDE });
    if (!exam) throw new AppException('MOCK_EXAM_NOT_FOUND', 'Mock imtihon topilmadi', 404);
    const staff = isStaff(viewer);
    if (!staff && !exam.isPublished && !exam.isDemo) {
      throw new AppException('MOCK_EXAM_NOT_FOUND', 'Mock imtihon topilmadi', 404);
    }
    const access = await this.accessSvc.accessFor(viewer, exam);
    const row = exam as unknown as ExamRow;
    if (!staff && access !== 'granted') {
      return {
        ...shapeExamMeta(row),
        price: exam.price,
        isFreeForApproved: exam.isFreeForApproved,
        access,
      };
    }
    return {
      ...shapeExam(row, staff, this.base),
      price: exam.price,
      isFreeForApproved: exam.isFreeForApproved,
      access,
    };
  }

  // ─────────────────────────── Section ───────────────────────────

  async createSection(actor: AuthUser, examId: string, dto: CreateSectionDto) {
    await this.examOrThrow(examId);
    const exists = await this.prisma.mockSection.findUnique({
      where: { examId_skill: { examId, skill: dto.skill } },
    });
    if (exists) {
      throw new AppException('MOCK_SECTION_EXISTS', 'Bu bo\'lim allaqachon mavjud', 409);
    }
    const section = await this.prisma.mockSection.create({
      data: {
        examId,
        skill: dto.skill,
        title: dto.title,
        sortOrder: dto.sortOrder ?? this.defaultSectionOrder(dto.skill),
        durationMinutes: dto.durationMinutes,
        instructions: dto.instructions,
      },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'mock.section.create',
      entity: 'mockSection',
      entityId: section.id,
      newValue: { examId, skill: dto.skill },
    });
    return section;
  }

  async updateSection(actor: AuthUser, sectionId: string, dto: UpdateSectionDto) {
    await this.sectionOrThrow(sectionId);
    const updated = await this.prisma.mockSection.update({
      where: { id: sectionId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.durationMinutes !== undefined ? { durationMinutes: dto.durationMinutes } : {}),
        ...(dto.instructions !== undefined ? { instructions: dto.instructions } : {}),
      },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'mock.section.update',
      entity: 'mockSection',
      entityId: sectionId,
    });
    return updated;
  }

  async deleteSection(actor: AuthUser, sectionId: string) {
    const section = await this.prisma.mockSection.findUnique({
      where: { id: sectionId },
      include: { groups: true },
    });
    if (!section) throw new AppException('MOCK_SECTION_NOT_FOUND', 'Bo\'lim topilmadi', 404);
    for (const g of section.groups) {
      if (g.audioKey) this.storage.delete(g.audioKey);
      if (g.imageKey) this.storage.delete(g.imageKey);
    }
    await this.prisma.mockSection.delete({ where: { id: sectionId } });
    await this.audit.log({
      userId: actor.id,
      action: 'mock.section.delete',
      entity: 'mockSection',
      entityId: sectionId,
    });
    return { deleted: true };
  }

  // ─────────────────────────── Group ───────────────────────────

  async createGroup(actor: AuthUser, sectionId: string, dto: CreateGroupDto) {
    await this.sectionOrThrow(sectionId);
    const count = await this.prisma.mockQuestionGroup.count({ where: { sectionId } });
    const group = await this.prisma.mockQuestionGroup.create({
      data: {
        sectionId,
        sortOrder: dto.sortOrder ?? count,
        title: dto.title,
        instructions: dto.instructions,
        passageText: dto.passageText,
      },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'mock.group.create',
      entity: 'mockQuestionGroup',
      entityId: group.id,
      newValue: { sectionId },
    });
    return group;
  }

  async updateGroup(actor: AuthUser, groupId: string, dto: UpdateGroupDto) {
    await this.groupOrThrow(groupId);
    const updated = await this.prisma.mockQuestionGroup.update({
      where: { id: groupId },
      data: {
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.instructions !== undefined ? { instructions: dto.instructions } : {}),
        ...(dto.passageText !== undefined ? { passageText: dto.passageText } : {}),
      },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'mock.group.update',
      entity: 'mockQuestionGroup',
      entityId: groupId,
    });
    return updated;
  }

  async deleteGroup(actor: AuthUser, groupId: string) {
    const group = await this.groupOrThrow(groupId);
    if (group.audioKey) this.storage.delete(group.audioKey);
    if (group.imageKey) this.storage.delete(group.imageKey);
    await this.prisma.mockQuestionGroup.delete({ where: { id: groupId } });
    await this.audit.log({
      userId: actor.id,
      action: 'mock.group.delete',
      entity: 'mockQuestionGroup',
      entityId: groupId,
    });
    return { deleted: true };
  }

  /** Listening audio / labelling rasm yuklash (multipart: audio?, image?) */
  async setGroupMedia(
    actor: AuthUser,
    groupId: string,
    files: { audio?: Express.Multer.File[]; image?: Express.Multer.File[] },
  ) {
    const group = await this.groupOrThrow(groupId);
    const data: Prisma.MockQuestionGroupUpdateInput = {};
    const audio = files.audio?.[0];
    const image = files.image?.[0];
    if (!audio && !image) {
      throw new AppException('NO_FILE', 'Fayl yuklanmadi (audio yoki image)', 400);
    }
    if (audio) {
      if (group.audioKey) this.storage.delete(group.audioKey);
      data.audioKey = `mock/${audio.filename}`;
    }
    if (image) {
      if (group.imageKey) this.storage.delete(group.imageKey);
      data.imageKey = `mock/${image.filename}`;
    }
    const updated = await this.prisma.mockQuestionGroup.update({ where: { id: groupId }, data });
    await this.audit.log({
      userId: actor.id,
      action: 'mock.group.media',
      entity: 'mockQuestionGroup',
      entityId: groupId,
    });
    return {
      id: updated.id,
      hasAudio: !!updated.audioKey,
      audioUrl: updated.audioKey ? `${this.base}/mock/groups/${groupId}/audio` : null,
      imageUrl: updated.imageKey ? `${this.base}/mock/groups/${groupId}/image` : null,
    };
  }

  /** Audio oqimi (Range qo'llab-quvvatlanadi). Demo bo'lmasa — auth talab qilinadi. */
  async streamMedia(
    viewer: AuthUser | undefined,
    groupId: string,
    kind: 'audio' | 'image',
    req: Request,
    res: Response,
  ) {
    const group = await this.prisma.mockQuestionGroup.findUnique({
      where: { id: groupId },
      include: {
        section: {
          include: {
            exam: {
              select: { id: true, isDemo: true, isPublished: true, price: true, isFreeForApproved: true },
            },
          },
        },
      },
    });
    if (!group) throw new AppException('MOCK_GROUP_NOT_FOUND', 'Blok topilmadi', 404);
    const key = kind === 'audio' ? group.audioKey : group.imageKey;
    if (!key || !this.storage.exists(key)) {
      throw new AppException('FILE_NOT_FOUND', 'Fayl topilmadi', 404);
    }
    if (!viewer && !group.section.exam.isDemo) {
      throw new AppException('UNAUTHORIZED', 'Avval tizimga kiring', 401);
    }
    if (viewer && !isStaff(viewer)) {
      const access = await this.accessSvc.accessFor(viewer, group.section.exam);
      if (access === 'pending') {
        throw new AppException('MOCK_PURCHASE_PENDING', 'Xaridingiz tasdiqlanishini kuting', 402);
      }
      if (access !== 'granted') {
        throw new AppException('MOCK_PAYMENT_REQUIRED', "Bu imtihon uchun to'lov talab qilinadi", 402);
      }
    }

    const stat = this.storage.stat(key);
    const contentType = kind === 'audio' ? audioContentType(key) : 'image/*';
    const range = req.headers.range;
    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      const start = match && match[1] ? parseInt(match[1], 10) : 0;
      const end = match && match[2] ? parseInt(match[2], 10) : stat.size - 1;
      if (start >= stat.size || end >= stat.size) {
        res.status(416).set({ 'Content-Range': `bytes */${stat.size}` }).end();
        return;
      }
      res.status(206).set({
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': contentType,
      });
      this.storage.createReadStream(key, { start, end }).pipe(res);
    } else {
      res.status(200).set({
        'Content-Length': stat.size,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      });
      this.storage.createReadStream(key).pipe(res);
    }
  }

  // ─────────────────────────── Question ───────────────────────────

  // ─────────────────────────── Paste → parse → import ───────────────────────────

  /** Yopishtirilgan matnni parse qiladi (preview — bazaga yozmaydi) */
  parsePreview(text: string) {
    const result = parseQuestions(text);
    return {
      instructions: result.instructions,
      count: result.questions.length,
      questions: result.questions,
    };
  }

  /** Matndan savollarni parse qilib, javob kaliti (raqam bo'yicha) bilan blokka qo'shadi */
  async importQuestions(actor: AuthUser, groupId: string, dto: ImportQuestionsDto) {
    const group = await this.prisma.mockQuestionGroup.findUnique({
      where: { id: groupId },
      include: { section: { select: { skill: true, exam: { select: { type: true } } } } },
    });
    if (!group) throw new AppException('MOCK_GROUP_NOT_FOUND', 'Blok topilmadi', 404);

    const parsed = parseQuestions(dto.text);
    if (parsed.questions.length === 0) {
      throw new AppException('NO_QUESTIONS_PARSED', 'Matndan savol topilmadi', 400);
    }
    const isAuto = AUTO_SKILLS.includes(group.section.skill);
    const answers = dto.answers ?? {};
    const missing: number[] = [];
    const base = await this.prisma.mockQuestion.count({ where: { groupId } });

    const data = parsed.questions.map((q, i) => {
      let correctAnswers: string[] | undefined;
      if (isAuto) {
        const raw = answers[String(q.number)];
        if (raw && raw.trim()) correctAnswers = buildCorrectAnswers(q.type, q.options, raw.trim());
        else missing.push(q.number);
      }
      return {
        groupId,
        number: q.number,
        sortOrder: base + i,
        type: q.type,
        prompt: q.prompt,
        options: q.options ? (q.options as Prisma.InputJsonValue) : undefined,
        correctAnswers: correctAnswers ? (correctAnswers as Prisma.InputJsonValue) : undefined,
        points: this.resolvePoints(group.section.exam.type, isAuto, dto.points),
      };
    });
    if (isAuto && missing.length) {
      throw new AppException(
        'MISSING_ANSWERS',
        `Quyidagi savollarga javob kiritilmagan: ${missing.join(', ')}`,
        400,
      );
    }

    // Muqaddima (Questions 1-5: ...) — blok ko'rsatmasi bo'sh bo'lsa to'ldiramiz
    if (parsed.instructions && !group.instructions) {
      await this.prisma.mockQuestionGroup.update({
        where: { id: groupId },
        data: { instructions: parsed.instructions },
      });
    }
    await this.prisma.mockQuestion.createMany({ data });
    await this.audit.log({
      userId: actor.id,
      action: 'mock.questions.import',
      entity: 'mockQuestionGroup',
      entityId: groupId,
      newValue: { count: data.length },
    });
    const questions = await this.prisma.mockQuestion.findMany({
      where: { groupId },
      orderBy: { sortOrder: 'asc' },
    });
    return { added: data.length, questions };
  }

  async addQuestions(actor: AuthUser, groupId: string, dto: AddQuestionsDto) {
    const group = await this.prisma.mockQuestionGroup.findUnique({
      where: { id: groupId },
      include: { section: { select: { skill: true, exam: { select: { type: true } } } } },
    });
    if (!group) throw new AppException('MOCK_GROUP_NOT_FOUND', 'Blok topilmadi', 404);

    const isAuto = AUTO_SKILLS.includes(group.section.skill);
    const base = await this.prisma.mockQuestion.count({ where: { groupId } });

    dto.questions.forEach((q, i) => this.validateQuestion(q, isAuto, i));

    await this.prisma.mockQuestion.createMany({
      data: dto.questions.map((q, i) => ({
        groupId,
        number: q.number,
        sortOrder: q.sortOrder ?? base + i,
        type: q.type,
        prompt: q.prompt,
        options: q.options ? (q.options as Prisma.InputJsonValue) : undefined,
        correctAnswers: q.correctAnswers ? (q.correctAnswers as Prisma.InputJsonValue) : undefined,
        points: this.resolvePoints(group.section.exam.type, isAuto, q.points, `#${i + 1}-savol: `),
        wordLimit: q.wordLimit,
      })),
    });
    await this.audit.log({
      userId: actor.id,
      action: 'mock.questions.add',
      entity: 'mockQuestionGroup',
      entityId: groupId,
      newValue: { count: dto.questions.length },
    });

    const questions = await this.prisma.mockQuestion.findMany({
      where: { groupId },
      orderBy: { sortOrder: 'asc' },
    });
    return { added: dto.questions.length, questions };
  }

  async updateQuestion(actor: AuthUser, questionId: string, dto: UpdateQuestionDto) {
    const question = await this.prisma.mockQuestion.findUnique({
      where: { id: questionId },
      include: {
        group: { include: { section: { select: { skill: true, exam: { select: { type: true } } } } } },
      },
    });
    if (!question) throw new AppException('MOCK_QUESTION_NOT_FOUND', 'Savol topilmadi', 404);

    const type = dto.type ?? question.type;
    const isAuto = AUTO_SKILLS.includes(question.group.section.skill);
    const merged = {
      number: dto.number ?? question.number,
      type,
      prompt: dto.prompt ?? question.prompt,
      options: dto.options ?? (question.options as string[] | null) ?? undefined,
      correctAnswers:
        dto.correctAnswers ?? (question.correctAnswers as string[] | null) ?? undefined,
      points: dto.points,
      wordLimit: dto.wordLimit,
    };
    this.validateQuestion(merged, isAuto, 0);

    const updated = await this.prisma.mockQuestion.update({
      where: { id: questionId },
      data: {
        ...(dto.number !== undefined ? { number: dto.number } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.prompt !== undefined ? { prompt: dto.prompt } : {}),
        ...(dto.options !== undefined
          ? { options: dto.options as Prisma.InputJsonValue }
          : {}),
        ...(dto.correctAnswers !== undefined
          ? { correctAnswers: dto.correctAnswers as Prisma.InputJsonValue }
          : {}),
        ...(dto.points !== undefined
          ? {
              points: this.resolvePoints(
                question.group.section.exam.type,
                isAuto,
                dto.points,
              ),
            }
          : {}),
        ...(dto.wordLimit !== undefined ? { wordLimit: dto.wordLimit } : {}),
      },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'mock.question.update',
      entity: 'mockQuestion',
      entityId: questionId,
    });
    return updated;
  }

  async deleteQuestion(actor: AuthUser, questionId: string) {
    const question = await this.prisma.mockQuestion.findUnique({ where: { id: questionId } });
    if (!question) throw new AppException('MOCK_QUESTION_NOT_FOUND', 'Savol topilmadi', 404);
    await this.prisma.mockQuestion.delete({ where: { id: questionId } });
    await this.audit.log({
      userId: actor.id,
      action: 'mock.question.delete',
      entity: 'mockQuestion',
      entityId: questionId,
    });
    return { deleted: true };
  }

  // ─────────────────────────── Helpers ───────────────────────────

  private validateQuestion(
    q: { type: MockQuestionType; options?: string[]; correctAnswers?: string[] },
    isAuto: boolean,
    index: number,
  ): void {
    const at = `#${index + 1}-savol: `;
    if (OPTION_TYPES.has(q.type) && (!q.options || q.options.length < 2)) {
      throw new AppException('OPTIONS_REQUIRED', `${at}variantlar kamida 2 ta bo'lsin`, 400);
    }
    if (isAuto && (!q.correctAnswers || q.correctAnswers.length === 0)) {
      throw new AppException(
        'CORRECT_ANSWER_REQUIRED',
        `${at}Listening/Reading savoli uchun to'g'ri javob majburiy`,
        400,
      );
    }
  }

  private resolvePoints(
    examType: MockExamType,
    isAuto: boolean,
    points: number | undefined,
    label = '',
  ): number {
    const ielts = examType === 'ielts_academic' || examType === 'ielts_general';
    if (!isAuto && ielts) {
      if (points !== undefined && points !== IELTS_MANUAL_POINTS) {
        throw new AppException(
          'VALIDATION_ERROR',
          `${label}IELTS Writing/Speaking savoli uchun points aynan ${IELTS_MANUAL_POINTS} bo'lsin (band shkalasi 0–9, qo'lda baholash)`,
          400,
        );
      }
      return IELTS_MANUAL_POINTS;
    }
    return points ?? 1;
  }

  private defaultSectionOrder(skill: string): number {
    return ['listening', 'reading', 'writing', 'speaking'].indexOf(skill);
  }

  private async examOrThrow(id: string) {
    const exam = await this.prisma.mockExam.findUnique({ where: { id } });
    if (!exam) throw new AppException('MOCK_EXAM_NOT_FOUND', 'Mock imtihon topilmadi', 404);
    return exam;
  }

  private async sectionOrThrow(id: string) {
    const section = await this.prisma.mockSection.findUnique({ where: { id } });
    if (!section) throw new AppException('MOCK_SECTION_NOT_FOUND', 'Bo\'lim topilmadi', 404);
    return section;
  }

  private async groupOrThrow(id: string) {
    const group = await this.prisma.mockQuestionGroup.findUnique({ where: { id } });
    if (!group) throw new AppException('MOCK_GROUP_NOT_FOUND', 'Blok topilmadi', 404);
    return group;
  }
}
