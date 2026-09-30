import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MockAuthoringService } from './mock-authoring.service';
import { CreateMockExamDto, SaveGroupContentDto } from './dto/mock.dto';
import { starterSections } from './mock-starter';

function setup() {
  const group = {
    id: 'group', questions: [{ id: 'existing', number: 1 }],
    section: { skill: 'reading', exam: { id: 'exam', type: 'ielts_academic', createdById: 'owner', isPublished: false } },
  };
  const tx = {
    mockQuestionGroup: { findUnique: vi.fn().mockResolvedValue(group), update: vi.fn() },
    mockAttempt: { count: vi.fn().mockResolvedValue(0) },
    mockQuestion: {
      findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn(),
      update: vi.fn().mockImplementation(async ({ where, data }) => ({ id: where.id, ...data })),
      create: vi.fn().mockImplementation(async ({ data }) => ({ id: 'new-id', ...data })),
    },
  };
  const prisma = { ...tx, mockExam: { create: vi.fn().mockResolvedValue({ id: 'exam' }) }, $transaction: vi.fn(async (fn) => fn(tx)) };
  const audit = { log: vi.fn() };
  const service = new MockAuthoringService(prisma as never, audit as never, {} as never, {} as never, { get: () => undefined } as never);
  const actor = { id: 'owner', role: 'teacher' } as never;
  const dto: SaveGroupContentDto = {
    title: 'Passage', deletedQuestionIds: [],
    questions: [{ id: 'existing', number: 1, type: 'short_answer', prompt: 'First question', correctAnswers: ['answer'] }],
  };
  return { service, prisma, tx, group, actor, dto };
}

describe('atomic block authoring', () => {
  it('retains IDs, returns newly created IDs and persists visual ordering in one transaction', async () => {
    const { service, prisma, tx, actor, dto } = setup();
    dto.questions.unshift({ number: 2, type: 'short_answer', prompt: 'New question', correctAnswers: ['new'] });
    const result = await service.saveGroupContent(actor, 'group', dto);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(result.questions.map((q) => q.id)).toEqual(['new-id', 'existing']);
    expect(tx.mockQuestion.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sortOrder: 1, options: [], wordLimit: null }) }));
  });

  it('validates the entire batch before changing material or deleting questions', async () => {
    const { service, tx, actor, dto } = setup();
    dto.questions.push({ number: 2, type: 'short_answer', prompt: 'Missing answer' });
    await expect(service.saveGroupContent(actor, 'group', dto)).rejects.toMatchObject({ code: 'CORRECT_ANSWER_REQUIRED' });
    expect(tx.mockQuestionGroup.update).not.toHaveBeenCalled();
    expect(tx.mockQuestion.deleteMany).not.toHaveBeenCalled();
    expect(tx.mockQuestion.update).not.toHaveBeenCalled();
  });

  it('rejects question IDs belonging to another block', async () => {
    const { service, actor, dto } = setup();
    dto.questions[0].id = 'foreign';
    await expect(service.saveGroupContent(actor, 'group', dto)).rejects.toMatchObject({ code: 'MOCK_CONTENT_CONFLICT' });
  });

  it('rejects duplicate numbers locally and across the exam', async () => {
    const { service, tx, actor, dto } = setup();
    dto.questions.push({ ...dto.questions[0], id: undefined });
    await expect(service.saveGroupContent(actor, 'group', dto)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    dto.questions.pop();
    tx.mockQuestion.findMany.mockResolvedValue([{ number: 1 }]);
    await expect(service.saveGroupContent(actor, 'group', dto)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('requires explicit deletion and does not erase concurrent additions', async () => {
    const { service, tx, actor, dto } = setup();
    dto.questions = [];
    await expect(service.saveGroupContent(actor, 'group', dto)).rejects.toMatchObject({ code: 'MOCK_CONTENT_CONFLICT' });
    dto.deletedQuestionIds = ['existing'];
    await service.saveGroupContent(actor, 'group', dto);
    expect(tx.mockQuestion.deleteMany).toHaveBeenCalledWith({ where: { groupId: 'group', id: { in: ['existing'] } } });
  });

  it('enforces teacher ownership', async () => {
    const { service, group, actor, dto, tx } = setup();
    group.section.exam.createdById = 'another-teacher';
    await expect(service.saveGroupContent(actor, 'group', dto)).rejects.toMatchObject({ code: 'MOCK_NOT_OWNER' });
    expect(tx.mockQuestionGroup.update).not.toHaveBeenCalled();
  });

  it('protects published exams and exams with student attempts', async () => {
    const { service, group, actor, dto, tx } = setup();
    group.section.exam.isPublished = true;
    await expect(service.saveGroupContent(actor, 'group', dto)).rejects.toMatchObject({ code: 'MOCK_CONTENT_LOCKED' });
    group.section.exam.isPublished = false;
    tx.mockAttempt.count.mockResolvedValue(1);
    await expect(service.saveGroupContent(actor, 'group', dto)).rejects.toMatchObject({ code: 'MOCK_CONTENT_LOCKED' });
  });

  it('rejects malformed and oversized HTTP payloads', async () => {
    const invalid = plainToInstance(SaveGroupContentDto, { questions: [{ number: 0, type: 'unknown', prompt: '' }], deletedQuestionIds: [] });
    expect((await validate(invalid)).length).toBeGreaterThan(0);
    invalid.questions = Array(201).fill({ number: 1, type: 'short_answer', prompt: 'Question' });
    expect((await validate(invalid)).length).toBeGreaterThan(0);
    expect((await validate(plainToInstance(CreateMockExamDto, { type: 'ielts_academic', title: 'Example', starterStructure: 'yes' }))).length).toBeGreaterThan(0);
  });
});

describe('exam starter structure', () => {
  it('creates all IELTS units as empty editable blocks', () => {
    const sections = starterSections('ielts_academic');
    expect(sections.map((s) => (s.groups!.create as unknown[]).length)).toEqual([4, 3, 2, 3]);
    expect(sections[1].durationMinutes).toBe(60);
    expect(JSON.stringify(sections)).not.toContain('correctAnswers');
  });
  it('uses one flexible block per Multilevel skill', () => {
    expect(starterSections('multilevel').map((s) => (s.groups!.create as unknown[]).length)).toEqual([1, 1, 1, 1]);
  });
  it('keeps blank creation backward compatible and creates the structure in the same nested write', async () => {
    const { service, prisma, actor } = setup();
    await service.createExam(actor, { type: 'ielts_general', title: 'Blank exam' });
    expect(prisma.mockExam.create.mock.calls[0][0].data.sections).toBeUndefined();
    await service.createExam(actor, { type: 'ielts_general', title: 'Prepared exam', starterStructure: true });
    expect(prisma.mockExam.create.mock.calls[1][0].data.sections.create).toHaveLength(4);
  });
});
