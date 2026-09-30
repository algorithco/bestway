// Run against the local Docker database after building the backend.
// Creates only one temporary exam and deletes that exact exam in finally.
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { ConfigService } = require('@nestjs/config');
const { MockAuthoringService } = require(require('node:path').resolve(process.cwd(), 'dist/mock/mock-authoring.service'));

async function main() {
  const prisma = new PrismaClient();
  let examId;
  const service = new MockAuthoringService(prisma, { log: async () => {} }, {}, {}, new ConfigService());
  try {
    const actor = await prisma.user.findFirst({ where: { role: { in: ['admin', 'super_admin'] } } });
    assert(actor, 'A local admin is required for the authoring check');
    const exam = await service.createExam(actor, {
      type: 'ielts_academic', title: 'Temporary authoring verification', starterStructure: true,
    });
    examId = exam.id;
    const sections = await prisma.mockSection.findMany({ where: { examId }, include: { groups: true }, orderBy: { sortOrder: 'asc' } });
    assert.deepEqual(sections.map((s) => s.groups.length), [4, 3, 2, 3]);
    assert.equal(exam.isPublished, false);
    const groupId = sections[1].groups[0].id;
    const input = {
      title: 'Verified material', deletedQuestionIds: [],
      questions: Array.from({ length: 40 }, (_, i) => ({
        number: i + 1, type: 'short_answer', prompt: 'Question ' + (i + 1), correctAnswers: ['answer'],
      })),
    };
    const first = await service.saveGroupContent(actor, groupId, input);
    assert.equal(first.saved, 40);
    input.questions = first.questions.map((q) => ({ ...input.questions[q.number - 1], id: q.id }));
    const again = await service.saveGroupContent(actor, groupId, input);
    assert.deepEqual(again.questions.map((q) => q.id), first.questions.map((q) => q.id));
    assert.equal(await prisma.mockQuestion.count({ where: { groupId } }), 40);

    await assert.rejects(service.saveGroupContent(actor, groupId, {
      ...input, title: 'Should not persist', questions: [...input.questions, { number: 41, type: 'short_answer', prompt: 'No answer' }],
    }), (e) => e.code === 'CORRECT_ANSWER_REQUIRED');
    assert.equal((await prisma.mockQuestionGroup.findUnique({ where: { id: groupId } })).title, 'Verified material');

    // Inject a failure after the real transaction updates material and existing questions.
    // PostgreSQL must roll those writes back when the subsequent insert fails.
    const failingPrisma = {
      $transaction: (fn, options) => prisma.$transaction((tx) => fn({
        ...tx,
        mockQuestion: { ...tx.mockQuestion, create: async () => { throw new Error('simulated insert failure'); } },
      }), options),
    };
    const failing = new MockAuthoringService(failingPrisma, { log: async () => {} }, {}, {}, new ConfigService());
    await assert.rejects(failing.saveGroupContent(actor, groupId, {
      ...input, title: 'Rollback this title',
      questions: [...input.questions.map((q) => ({ ...q, prompt: 'Rollback this prompt' })),
        { number: 41, type: 'short_answer', prompt: 'Valid question', correctAnswers: ['answer'] }],
    }), /simulated insert failure/);
    assert.equal((await prisma.mockQuestionGroup.findUnique({ where: { id: groupId } })).title, 'Verified material');
    assert.equal((await prisma.mockQuestion.findUnique({ where: { id: first.questions[0].id } })).prompt, 'Question 1');

    const removed = input.questions.shift();
    await service.saveGroupContent(actor, groupId, { ...input, deletedQuestionIds: [removed.id] });
    assert.equal(await prisma.mockQuestion.count({ where: { groupId } }), 39);
    console.log('PASS: starter creation, 40-question save, repeat save, validation, PostgreSQL rollback and deletion');
  } finally {
    if (examId) await prisma.mockExam.delete({ where: { id: examId } });
    await prisma.$disconnect();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
