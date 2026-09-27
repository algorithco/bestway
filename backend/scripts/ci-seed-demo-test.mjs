/**
 * CI-only seed: recreates the demo IELTS test that `npm run seed` no longer
 * creates (demo seeds were dropped from prod seed), but `npm run test:smoke`
 * still requires: guest demo list (>=1, all isDemo) + an `ielts` test with
 * listening/reading (auto) + writing/speaking (manual) sections.
 *
 * Idempotent: skips creation if the title already exists.
 *
 * Usage (CI, DATABASE_URL from env):
 *   node scripts/ci-seed-demo-test.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TITLE = 'IELTS Mock Test #1 (Demo)';

async function main() {
  const existing = await prisma.test.findFirst({ where: { title: TITLE } });
  if (existing) {
    console.log(`CI demo test already exists: ${TITLE}`);
    return;
  }
  const ielts = await prisma.test.create({
    data: {
      type: 'ielts',
      title: TITLE,
      level: 'Academic',
      isDemo: true,
      durationMinutes: 60,
      sectionQuestionCounts: { listening: 3, reading: 3 },
    },
  });
  const q = (section, type, prompt, options, correctAnswer, maxScore = 1) => ({
    testId: ielts.id,
    section,
    type,
    prompt,
    options: options ?? undefined,
    correctAnswer,
    maxScore,
  });
  await prisma.question.createMany({
    data: [
      // Listening (auto)
      q('listening', 'multiple_choice', 'The woman wants to book a room for ___ nights.', ['two', 'three', 'four'], 'three'),
      q('listening', 'multiple_choice', 'What time does the library open on weekends?', ['8 AM', '9 AM', '10 AM'], '10 AM'),
      q('listening', 'short_answer', "Write the caller's postcode.", undefined, 'BH246GL|bh24 6gl|bh246gl'),
      q('listening', 'multiple_choice', 'The lecture is mainly about ___.', ['urban planning', 'marine biology', 'renewable energy'], 'renewable energy'),
      // Reading (auto)
      q('reading', 'multiple_choice', 'According to the passage, the main cause of soil erosion is ___.', ['deforestation', 'flooding', 'construction'], 'deforestation'),
      q('reading', 'multiple_choice', 'The word "profound" in paragraph 2 is closest in meaning to ___.', ['deep', 'quick', 'visible'], 'deep'),
      q('reading', 'short_answer', 'In which year was the research station established? (Write a number)', undefined, '1987'),
      q('reading', 'multiple_choice', 'What does the author suggest in the final paragraph?', ['further research is needed', 'the problem is solved', 'funding should stop'], 'further research is needed'),
      // Writing (manual, maxScore 9 — smoke grades with 7)
      q('writing', 'essay', 'Task 2: Some people believe that students should study online instead of attending school. To what extent do you agree or disagree? Write at least 250 words.', undefined, undefined, 9),
      // Speaking (manual)
      q('speaking', 'speaking_prompt', 'Part 2: Describe a teacher who has influenced you. You should say: who this person is, how you met them, and why they influenced you.', undefined, undefined, 9),
    ],
  });
  console.log(`CI demo test created: ${TITLE}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
