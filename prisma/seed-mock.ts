/**
 * Real mock imtihon seed — to'liq IELTS Academic mock (4 bo'lim).
 * Ishga tushirish: npm run seed:mock
 * Idempotent: bir xil sarlavhali imtihon bo'lsa qayta yaratmaydi.
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

const READING_PASSAGE = `Urban beekeeping has grown rapidly in the last decade. Once confined to the countryside, hives now appear on city rooftops from London to Tokyo. Supporters argue that bees improve the pollination of city gardens and raise awareness of environmental issues. Critics, however, warn that too many hives in a small area may leave insufficient forage, harming both managed and wild bee populations. Researchers recommend planting more bee-friendly flowers alongside any increase in the number of hives.`;

async function main() {
  const title = 'IELTS Academic — Real Mock #1';
  const existing = await prisma.mockExam.findFirst({ where: { title } });
  if (existing) {
    console.log(`"${title}" allaqachon mavjud (id=${existing.id}). O'tkazib yuborildi.`);
    return;
  }

  const exam = await prisma.mockExam.create({
    data: {
      type: 'ielts_academic',
      title,
      description: 'To\'liq 4 bo\'limli IELTS Academic amaliy mock imtihon (band baholash bilan).',
      level: 'Academic',
      isPublished: true,
      isDemo: true,
      sections: {
        create: [
          // ─────────── Listening ───────────
          {
            skill: 'listening',
            title: 'Listening',
            sortOrder: 0,
            durationMinutes: 30,
            instructions: 'Audio bir marta ijro etiladi. Har bo\'sh joyga javob yozing.',
            groups: {
              create: [
                {
                  sortOrder: 0,
                  title: 'Questions 1–8',
                  instructions:
                    'Complete the notes. Write ONE WORD AND/OR A NUMBER for each answer.',
                  questions: {
                    create: [
                      { number: 1, sortOrder: 0, type: 'note_completion', prompt: "Caller's surname: ______", correctAnswers: ['Thompson'], points: 1 },
                      { number: 2, sortOrder: 1, type: 'note_completion', prompt: 'Order number: ______', correctAnswers: ['4471'], points: 1 },
                      { number: 3, sortOrder: 2, type: 'multiple_choice', prompt: 'Preferred delivery option:', options: ['Standard', 'Express', 'Premium'], correctAnswers: ['Express'], points: 1 },
                      { number: 4, sortOrder: 3, type: 'short_answer', prompt: 'Deposit amount (in pounds):', correctAnswers: ['50', 'fifty'], points: 1 },
                      { number: 5, sortOrder: 4, type: 'note_completion', prompt: 'Appointment day: ______', correctAnswers: ['Tuesday'], points: 1 },
                      { number: 6, sortOrder: 5, type: 'multiple_choice', prompt: 'The customer heard about the service via ______.', options: ['a friend', 'the radio', 'an advert'], correctAnswers: ['a friend'], points: 1 },
                      { number: 7, sortOrder: 6, type: 'note_completion', prompt: 'Meeting room is on the ______ floor.', correctAnswers: ['third', '3rd'], points: 1 },
                      { number: 8, sortOrder: 7, type: 'short_answer', prompt: 'The contact phone number ends in:', correctAnswers: ['229'], points: 1 },
                    ],
                  },
                },
              ],
            },
          },
          // ─────────── Reading ───────────
          {
            skill: 'reading',
            title: 'Reading',
            sortOrder: 1,
            durationMinutes: 60,
            instructions: 'Read the passage and answer the questions.',
            groups: {
              create: [
                {
                  sortOrder: 0,
                  title: 'Questions 9–15',
                  instructions:
                    'Read the passage "Urban Beekeeping" below and answer questions 9–15.',
                  passageText: READING_PASSAGE,
                  questions: {
                    create: [
                      { number: 9, sortOrder: 0, type: 'true_false_notgiven', prompt: 'Urban beekeeping was more common in cities than in the countryside in the past.', options: ['TRUE', 'FALSE', 'NOT GIVEN'], correctAnswers: ['FALSE'], points: 1 },
                      { number: 10, sortOrder: 1, type: 'true_false_notgiven', prompt: 'Hives can now be found in Tokyo.', options: ['TRUE', 'FALSE', 'NOT GIVEN'], correctAnswers: ['TRUE'], points: 1 },
                      { number: 11, sortOrder: 2, type: 'true_false_notgiven', prompt: 'Most researchers are opposed to urban beekeeping.', options: ['TRUE', 'FALSE', 'NOT GIVEN'], correctAnswers: ['NOT GIVEN'], points: 1 },
                      { number: 12, sortOrder: 3, type: 'multiple_choice', prompt: 'According to critics, a risk of too many hives is ______.', options: ['better pollination', 'insufficient forage', 'cheaper honey'], correctAnswers: ['insufficient forage'], points: 1 },
                      { number: 13, sortOrder: 4, type: 'sentence_completion', prompt: 'Researchers recommend planting more bee-friendly ______.', correctAnswers: ['flowers'], points: 1, wordLimit: 1 },
                      { number: 14, sortOrder: 5, type: 'short_answer', prompt: 'Where do hives now commonly appear in cities? (TWO WORDS)', correctAnswers: ['city rooftops', 'rooftops'], points: 1, wordLimit: 2 },
                      { number: 15, sortOrder: 6, type: 'matching_headings', prompt: 'Choose the best heading for the passage.', options: ['A history of honey', 'The rise and risks of urban beekeeping', 'How to build a hive'], correctAnswers: ['The rise and risks of urban beekeeping'], points: 1 },
                    ],
                  },
                },
              ],
            },
          },
          // ─────────── Writing ───────────
          {
            skill: 'writing',
            title: 'Writing',
            sortOrder: 2,
            durationMinutes: 60,
            instructions: "Ikki vazifa. Task 2 ballda ikki barobar og'irroq.",
            groups: {
              create: [
                {
                  sortOrder: 0,
                  title: 'Writing Tasks',
                  questions: {
                    create: [
                      { number: 16, sortOrder: 0, type: 'essay_task1', prompt: 'Task 1: The chart below shows the number of urban hives in three cities between 2010 and 2020. Summarise the information by selecting and reporting the main features. Write at least 150 words.', points: 9 },
                      { number: 17, sortOrder: 1, type: 'essay_task2', prompt: 'Task 2: Some people think cities should encourage beekeeping, while others believe it causes problems. Discuss both views and give your own opinion. Write at least 250 words.', points: 9 },
                    ],
                  },
                },
              ],
            },
          },
          // ─────────── Speaking ───────────
          {
            skill: 'speaking',
            title: 'Speaking',
            sortOrder: 3,
            durationMinutes: 15,
            instructions: "Ovozli javob matn ko'rinishida yozilishi mumkin (yoki o'qituvchi jonli baholaydi).",
            groups: {
              create: [
                {
                  sortOrder: 0,
                  title: 'Speaking Parts',
                  questions: {
                    create: [
                      { number: 18, sortOrder: 0, type: 'speaking_task', prompt: 'Part 2: Describe a time you spent in nature. You should say where you went, what you did, and how you felt.', points: 9 },
                      { number: 19, sortOrder: 1, type: 'speaking_task', prompt: 'Part 3: Do you think city life makes people less connected to nature? Why or why not?', points: 9 },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  });

  const count = await prisma.mockQuestion.count({
    where: { group: { section: { examId: exam.id } } },
  });
  console.log(`Mock imtihon yaratildi: "${title}"`);
  console.log(`  id = ${exam.id}`);
  console.log(`  bo'limlar = Listening, Reading, Writing, Speaking`);
  console.log(`  jami savollar = ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
