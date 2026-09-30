const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { TestsService } = require(require('node:path').resolve(process.cwd(), 'dist/tests/tests.service'));

async function main() {
  const prisma = new PrismaClient();
  const service = new TestsService(prisma, { log: async () => {} });
  let testId;
  try {
    const test = await prisma.test.create({ data: { type: 'ielts', title: 'Temporary smart paste verification', isActive: false } });
    testId = test.id;
    const rows = Array.from({ length: 40 }, (_, index) => `${index + 1}. Complete question ${index + 1}: answer is ___.`).join('\n');
    const key = Array.from({ length: 40 }, (_, index) => `${index + 1}: answer-${index + 1}`).join('\n');
    const result = await service.importQuestions({ id: 'integration-admin' }, testId, { text: `[READING]\n${rows}\nANSWER KEY\n${key}` });
    assert.equal(result.added, 40);
    assert.equal(await prisma.question.count({ where: { testId } }), 40);
    await assert.rejects(
      service.importQuestions({ id: 'integration-admin' }, testId, { text: '[READING]\n1. Missing answer' }),
      (error) => error.code === 'TEST_IMPORT_INVALID',
    );
    assert.equal(await prisma.question.count({ where: { testId } }), 40);
    console.log('PASS: 40-question smart paste and invalid-batch protection');
  } finally {
    if (testId) await prisma.test.delete({ where: { id: testId } });
    await prisma.$disconnect();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
