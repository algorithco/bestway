/**
 * Seed — dastlabki ma'lumotlar.
 * Ishga tushirish: npm run seed
 * Skript idempotent: qayta ishga tushirilsa dublikat yaratmaydi.
 */
import {
  PrismaClient,
  Role,
  TestType,
  TestSection,
  QuestionType,
  PaymentState,
  AttendanceState,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient();

const LINK_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function linkCode(): string {
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += LINK_CHARS[Math.floor(Math.random() * LINK_CHARS.length)];
  }
  return out;
}

async function upsertUser(opts: {
  name: string;
  phone: string;
  password: string;
  role: Role;
}) {
  const passwordHash = await bcrypt.hash(opts.password, 10);
  return prisma.user.upsert({
    where: { phone: opts.phone },
    update: {},
    create: { name: opts.name, phone: opts.phone, passwordHash, role: opts.role },
  });
}

async function ensureStudentProfile(userId: string, groupId: string | null, isApproved: boolean, initialPoints: number) {
  const existing = await prisma.studentProfile.findUnique({ where: { userId } });
  if (existing) return existing;
  const profile = await prisma.studentProfile.create({
    data: { userId, groupId, isApproved, currentPoints: initialPoints, linkCode: linkCode() },
  });
  await prisma.pointsLog.create({
    data: { studentId: userId, change: initialPoints, reason: "Boshlang'ich ball" },
  });
  await prisma.notification.create({
    data: {
      userId,
      type: 'points',
      text: `Xush kelibsiz! Sizga boshlang'ich ${initialPoints} ball berildi.`,
    },
  });
  return profile;
}

async function main() {
  // --- Sozlamalar ---
  await prisma.setting.upsert({
    where: { key: 'teacherPointLimit' },
    update: {},
    create: { key: 'teacherPointLimit', value: 20 },
  });
  await prisma.setting.upsert({
    where: { key: 'initialPoints' },
    update: {},
    create: { key: 'initialPoints', value: 100 },
  });

  // --- Foydalanuvchilar ---
  const superAdmin = await upsertUser({
    name: process.env.SEED_SUPER_ADMIN_NAME || 'Super Admin',
    phone: process.env.SEED_SUPER_ADMIN_PHONE || '+998900000001',
    password: process.env.SEED_SUPER_ADMIN_PASSWORD || 'Super123!',
    role: 'super_admin',
  });
  const admin = await upsertUser({
    name: 'Aziza Admin',
    phone: '+998900000002',
    password: 'Admin123!',
    role: 'admin',
  });
  const teacher = await upsertUser({
    name: 'Jasur Karimov (ustoz)',
    phone: '+998900000003',
    password: 'Teacher123!',
    role: 'teacher',
  });

  // --- Guruh ---
  let group = await prisma.group.findFirst({ where: { name: 'IELTS Foundation A' } });
  if (!group) {
    group = await prisma.group.create({
      data: {
        name: 'IELTS Foundation A',
        teacherId: teacher.id,
        schedule: [
          { day: 'mon', startTime: '14:00', endTime: '16:00' },
          { day: 'wed', startTime: '14:00', endTime: '16:00' },
          { day: 'fri', startTime: '14:00', endTime: '16:00' },
        ],
      },
    });
  }

  // --- O'quvchilar ---
  const student1 = await upsertUser({ name: 'Dilnoza Rahimova', phone: '+998900000010', password: 'Student123!', role: 'student' });
  const student2 = await upsertUser({ name: 'Bekzod Toshpulatov', phone: '+998900000011', password: 'Student123!', role: 'student' });
  const student3 = await upsertUser({ name: 'Madina Yusupova', phone: '+998900000012', password: 'Student123!', role: 'student' });

  await ensureStudentProfile(student1.id, group.id, true, 100);
  await ensureStudentProfile(student2.id, group.id, false, 100);
  await ensureStudentProfile(student3.id, group.id, false, 100);

  // --- Ota-ona (student1 ga bog'langan) ---
  const parent = await upsertUser({ name: 'Rahimov Akmal (ota)', phone: '+998900000020', password: 'Parent123!', role: 'parent' });
  await prisma.parentStudent.upsert({
    where: { parentUserId_studentId: { parentUserId: parent.id, studentId: student1.id } },
    update: {},
    create: { parentUserId: parent.id, studentId: student1.id },
  });

  // --- Joriy oy uchun to'lovlar ---
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();
  const payments: Array<{ studentId: string; state: PaymentState; amount: number; note?: string }> = [
    { studentId: student1.id, state: 'paid', amount: 500000 },
    { studentId: student2.id, state: 'unpaid', amount: 0 },
    { studentId: student3.id, state: 'partial', amount: 250000, note: 'Qolgan qismi oy oxirigacha' },
  ];
  for (const p of payments) {
    await prisma.payment.upsert({
      where: { studentId_month_year: { studentId: p.studentId, month, year } },
      update: {},
      create: { studentId: p.studentId, month, year, state: p.state, amount: p.amount, note: p.note, markedById: admin.id },
    });
  }

  // --- Bugungi davomat ---
  const today = new Date(new Date().toISOString().slice(0, 10));
  const attendance: Array<{ studentId: string; state: AttendanceState }> = [
    { studentId: student1.id, state: 'present' },
    { studentId: student2.id, state: 'late' },
    { studentId: student3.id, state: 'absent' },
  ];
  for (const a of attendance) {
    await prisma.attendance.upsert({
      where: { studentId_groupId_date: { studentId: a.studentId, groupId: group.id, date: today } },
      update: {},
      create: { studentId: a.studentId, groupId: group.id, date: today, state: a.state, markedById: teacher.id },
    });
  }

  // --- Demo IELTS test ---
  const ieltsTitle = 'IELTS Mock Test #1 (Demo)';
  let ielts = await prisma.test.findFirst({ where: { title: ieltsTitle } });
  if (!ielts) {
    ielts = await prisma.test.create({
      data: {
        type: 'ielts' as TestType,
        title: ieltsTitle,
        level: 'Academic',
        isDemo: true,
        durationMinutes: 60,
        sectionQuestionCounts: { listening: 3, reading: 3 },
      },
    });
    const q = (
      section: TestSection,
      type: QuestionType,
      prompt: string,
      options?: string[],
      correctAnswer?: string,
      maxScore = 1,
    ) => ({ testId: ielts!.id, section, type, prompt, options: options ?? undefined, correctAnswer, maxScore });

    await prisma.question.createMany({
      data: [
        // Listening
        q('listening', 'multiple_choice', 'The woman wants to book a room for ___ nights.', ['two', 'three', 'four'], 'three'),
        q('listening', 'multiple_choice', 'What time does the library open on weekends?', ['8 AM', '9 AM', '10 AM'], '10 AM'),
        q('listening', 'short_answer', 'Write the caller\'s postcode.', undefined, 'BH246GL|bh24 6gl|bh246gl'),
        q('listening', 'multiple_choice', 'The lecture is mainly about ___.', ['urban planning', 'marine biology', 'renewable energy'], 'renewable energy'),
        // Reading
        q('reading', 'multiple_choice', 'According to the passage, the main cause of soil erosion is ___.', ['deforestation', 'flooding', 'construction'], 'deforestation'),
        q('reading', 'multiple_choice', 'The word "profound" in paragraph 2 is closest in meaning to ___.', ['deep', 'quick', 'visible'], 'deep'),
        q('reading', 'short_answer', 'In which year was the research station established? (Write a number)', undefined, '1987'),
        q('reading', 'multiple_choice', 'What does the author suggest in the final paragraph?', ['further research is needed', 'the problem is solved', 'funding should stop'], 'further research is needed'),
        // Writing (qo'lda baholanadi)
        q('writing', 'essay', 'Task 2: Some people believe that students should study online instead of attending school. To what extent do you agree or disagree? Write at least 250 words.', undefined, undefined, 9),
        // Speaking (qo'lda baholanadi)
        q('speaking', 'speaking_prompt', 'Part 2: Describe a teacher who has influenced you. You should say: who this person is, how you met them, and why they influenced you.', undefined, undefined, 9),
      ],
    });
  }

  // --- Multilevel (CEFR) test ---
  const mlTitle = 'Multilevel Mock Test #1';
  let ml = await prisma.test.findFirst({ where: { title: mlTitle } });
  if (!ml) {
    ml = await prisma.test.create({
      data: {
        type: 'multilevel' as TestType,
        title: mlTitle,
        level: 'B1-B2',
        isDemo: false,
        durationMinutes: 45,
      },
    });
    await prisma.question.createMany({
      data: [
        { testId: ml.id, section: 'listening' as TestSection, type: 'multiple_choice' as QuestionType, prompt: 'Where does the conversation take place?', options: ['at a bank', 'at a station', 'at a hotel'], correctAnswer: 'at a station', maxScore: 1 },
        { testId: ml.id, section: 'reading' as TestSection, type: 'multiple_choice' as QuestionType, prompt: 'Choose the correct option: She ___ in Tashkent since 2019.', options: ['lives', 'has lived', 'is living'], correctAnswer: 'has lived', maxScore: 1 },
        { testId: ml.id, section: 'reading' as TestSection, type: 'short_answer' as QuestionType, prompt: 'Complete: I look forward to ___ from you. (one word)', correctAnswer: 'hearing', maxScore: 1 },
        { testId: ml.id, section: 'writing' as TestSection, type: 'essay' as QuestionType, prompt: 'Write an email to your friend inviting them to your birthday party (80-100 words).', maxScore: 10 },
        { testId: ml.id, section: 'speaking' as TestSection, type: 'speaking_prompt' as QuestionType, prompt: 'Talk about your daily routine for 1-2 minutes.', maxScore: 10 },
      ],
    });
  }

  // --- Maqolalar ---
  const artTitle = "Yangi o'quv yili uchun qabul boshlandi";
  const existingArt = await prisma.article.findFirst({ where: { title: artTitle } });
  if (!existingArt) {
    await prisma.article.createMany({
      data: [
        {
          title: artTitle,
          body: "Markazimizda IELTS, Multilevel va umumiy ingliz tili kurslariga qabul boshlandi. Birinchi dars — bepul sinov darsi. Batafsil ma'lumot uchun administratsiyaga murojaat qiling.",
          category: 'yangiliklar',
          tags: ['qabul', 'ielts', 'multilevel'],
          authorId: admin.id,
        },
        {
          title: 'IELTS Writing: eng ko\'p uchraydigan 5 xato',
          body: "1) Savolga to'liq javob bermaslik. 2) Reja tuzmasdan yozish. 3) Bir xil so'zlarni takrorlash. 4) Murakkab gaplarni noto'g'ri qurish. 5) Vaqtni noto'g'ri taqsimlash. Har biri haqida batafsil — darslarimizda.",
          category: 'maslahatlar',
          tags: ['ielts', 'writing'],
          authorId: admin.id,
        },
      ],
    });
  }

  console.log('Seed muvaffaqiyatli yakunlandi.');
  console.log('--- Kirish uchun akkauntlar ---');
  console.log(`super_admin: ${superAdmin.phone} / ${process.env.SEED_SUPER_ADMIN_PASSWORD || 'Super123!'}`);
  console.log('admin:       +998900000002 / Admin123!');
  console.log('teacher:     +998900000003 / Teacher123!');
  console.log('student:     +998900000010 / Student123! (tasdiqlangan)');
  console.log('student:     +998900000011 / Student123!');
  console.log('parent:      +998900000020 / Parent123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
