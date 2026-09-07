/**
 * full_test 4-skill flow verification (needs DB — uses throwaway fixtures).
 * Run: npx ts-node --transpile-only scripts/verify-fulltest-speaking.ts
 *
 * Covers:
 *  - 3x advanceSection() walks listening → reading → writing → speaking
 *  - 4th advance throws FLOW_COMPLETE (submission ends the attempt instead)
 *  - saving a speaking answer works after writing's deadline passed
 *    (overallDeadlineAt = null; regression: MOCK_TIME_UP on every action)
 *  - negative control: past overallDeadlineAt DOES block (proves the guard)
 *  - exam without speaking still ends at writing (FLOW_COMPLETE)
 */
import { MockAttemptService } from '../src/mock/mock-attempt.service';
import { PrismaService } from '../src/prisma/prisma.service';

let failures = 0;
function eq(actual: unknown, expected: unknown, label: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failures += 1;
    console.error(`FAIL ${label}: got ${a}, want ${e}`);
  } else {
    console.log(`ok ${label}`);
  }
}
async function expectCode(fn: () => Promise<unknown>, code: string, label: string): Promise<void> {
  try {
    await fn();
    failures += 1;
    console.error(`FAIL ${label}: expected throw ${code}, but succeeded`);
  } catch (e: any) {
    eq(e?.code ?? e?.message, code, label);
  }
}

const PAST = new Date(Date.now() - 60_000).toISOString();

async function makeExam(
  prisma: PrismaService,
  title: string,
  skills: Array<'listening' | 'reading' | 'writing' | 'speaking'>,
) {
  const qtype = (s: string) =>
    s === 'speaking' ? 'speaking_task' : s === 'writing' ? 'essay_task2' : 'multiple_choice';
  return prisma.mockExam.create({
    data: {
      type: 'ielts_academic',
      title,
      isDemo: true,
      sections: {
        create: skills.map((skill, i) => ({
          skill,
          title: skill,
          sortOrder: i,
          durationMinutes: 60,
          groups: {
            create: [
              {
                sortOrder: 0,
                title: `${skill} group`,
                questions: {
                  create: [
                    {
                      number: i + 1,
                      sortOrder: 0,
                      type: qtype(skill) as any,
                      prompt: `${skill} prompt`,
                      options: skill === 'speaking' || skill === 'writing' ? undefined : ['a', 'b'],
                    },
                  ],
                },
              },
            ],
          },
        })),
      },
    },
    include: { sections: { include: { groups: { include: { questions: true } } } } },
  });
}

function speakingQ(exam: Awaited<ReturnType<typeof makeExam>>): string {
  for (const s of exam.sections) {
    if ((s.skill as string) === 'speaking') return s.groups[0].questions[0].id;
  }
  throw new Error('no speaking question in fixture');
}

async function main() {
  const prisma = new PrismaService();
  const svc = new MockAttemptService(
    prisma as any,
    {} as any,
    {} as any,
    { get: () => 'http://localhost:3001' } as any,
  );
  const createdExamIds: string[] = [];
  try {
    const student = await prisma.studentProfile.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!student) {
      console.log('NO_FIXTURE_STUDENT');
      process.exit(2);
    }
    const me = { id: student.userId, studentProfile: {} } as any;

    // ── A. 4-skill exam: L → R → W → S ──
    const exam4 = await makeExam(prisma, 'verify-4skill-' + Date.now(), [
      'listening',
      'reading',
      'writing',
      'speaking',
    ]);
    createdExamIds.push(exam4.id);
    const attempt = await prisma.mockAttempt.create({
      data: {
        examId: exam4.id,
        studentId: student.userId,
        mode: 'timed',
        flowMode: 'full_test',
        currentSkill: 'listening',
        sectionDeadlines: {
          listening: PAST,
          reading: PAST,
          writing: PAST,
        } as any,
        deadlineAt: null,
        overallDeadlineAt: null,
        submittedSections: [],
      },
    });

    const r1 = await (svc as any).advanceSection(me, attempt.id);
    eq(r1.currentSkill, 'reading', 'advance 1 → reading');
    const r2 = await (svc as any).advanceSection(me, attempt.id);
    eq(r2.currentSkill, 'writing', 'advance 2 → writing');
    const r3 = await (svc as any).advanceSection(me, attempt.id);
    eq(r3.currentSkill, 'speaking', 'advance 3 → speaking');
    eq(r3.submittedSections, ['listening', 'reading', 'writing'], 'submitted sections tracked');
    await expectCode(
      () => (svc as any).advanceSection(me, attempt.id),
      'FLOW_COMPLETE',
      'advance 4 (past speaking) → FLOW_COMPLETE',
    );

    // Speaking save works with writing deadline long past + overall null.
    const s1 = await (svc as any).saveAnswer(me, attempt.id, {
      questionId: speakingQ(exam4),
      response: 'verify speaking notes',
    });
    eq(s1, { saved: true }, 'speaking save works after writing deadline passed');

    // Negative control: a past overall deadline MUST block (the reported bug).
    await prisma.mockAttempt.update({
      where: { id: attempt.id },
      data: { overallDeadlineAt: new Date(Date.now() - 1000) },
    });
    await expectCode(
      () => (svc as any).saveAnswer(me, attempt.id, { questionId: speakingQ(exam4), response: 'x' }),
      'MOCK_TIME_UP',
      'past overallDeadlineAt blocks speaking save (control)',
    );
    await prisma.mockAttempt.update({ where: { id: attempt.id }, data: { overallDeadlineAt: null } });
    const s2 = await (svc as any).saveAnswer(me, attempt.id, {
      questionId: speakingQ(exam4),
      response: 'verify speaking notes 2',
    });
    eq(s2, { saved: true }, 'speaking save works again with overall null (fix)');

    // ── A2. Heal path: stale overall cleared when entering speaking ──
    const stale = await prisma.mockAttempt.create({
      data: {
        examId: exam4.id,
        studentId: student.userId,
        mode: 'timed',
        flowMode: 'full_test',
        currentSkill: 'writing',
        sectionDeadlines: { listening: PAST, reading: PAST, writing: PAST } as any,
        deadlineAt: new Date(Date.now() - 1000),
        overallDeadlineAt: new Date(Date.now() - 1000),
        submittedSections: ['listening', 'reading'],
      },
    });
    const heal = await (svc as any).advanceSection(me, stale.id);
    eq(heal.currentSkill, 'speaking', 'stale attempt advances writing → speaking');
    const healed = await prisma.mockAttempt.findUnique({ where: { id: stale.id } });
    eq(healed?.overallDeadlineAt, null, 'entering speaking clears stale overall deadline');
    eq(healed?.deadlineAt, null, 'entering speaking clears stale deadlineAt');
    const s3 = await (svc as any).saveAnswer(me, stale.id, {
      questionId: speakingQ(exam4),
      response: 'healed notes',
    });
    eq(s3, { saved: true }, 'speaking save works on healed attempt');

    // ── B. 3-skill exam: order still ends at writing ──
    const exam3 = await makeExam(prisma, 'verify-3skill-' + Date.now(), [
      'listening',
      'reading',
      'writing',
    ]);
    createdExamIds.push(exam3.id);
    const attempt3 = await prisma.mockAttempt.create({
      data: {
        examId: exam3.id,
        studentId: student.userId,
        mode: 'timed',
        flowMode: 'full_test',
        currentSkill: 'writing',
        sectionDeadlines: { listening: PAST, reading: PAST, writing: PAST } as any,
        deadlineAt: new Date(Date.now() + 3600_000),
        overallDeadlineAt: new Date(Date.now() + 3600_000),
        submittedSections: ['listening', 'reading'],
      },
    });
    await expectCode(
      () => (svc as any).advanceSection(me, attempt3.id),
      'FLOW_COMPLETE',
      'no-speaking exam: advance past writing → FLOW_COMPLETE',
    );
  } finally {
    for (const id of createdExamIds) {
      await prisma.mockExam.delete({ where: { id } }).catch(() => undefined);
    }
    console.log('CLEANED');
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    if (failures > 0) {
      console.error(`${failures} check(s) FAILED`);
      process.exit(1);
    }
    console.log('ALL FULL-TEST SPEAKING CHECKS PASSED');
  })
  .catch((e) => {
    console.error('FAIL', e);
    process.exit(1);
  });
