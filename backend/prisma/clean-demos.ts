/**
 * Demo imtihonlarni BAZADAN O'CHIRADI (nafaqat yashiradi).
 * Ishga tushirish: npm run db:clean-demos
 *
 * O'chiradi:
 *  - Test (isDemo=true) + kaskad: Question, TestAttempt, Answer, AntiCheatEvent
 *  - MockExam (isDemo=true) + kaskad: Section/Group/Question, Attempt/Answer,
 *    CheatEvent, Purchase
 *  - Ularga tegishli storage fayllar (mock/*, tests/* audio/rasm)
 *
 * DIQQAT: o'chirish ortga qaytmaydi. Oldin backup oling:
 *   npm run db:backup
 * Admin qo'shgan (isDemo=false) imtihonlarga tegilmaydi.
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR ?? './storage');

function safeUnlink(key: string | null | undefined): boolean {
  if (!key) return false;
  const abs = path.resolve(STORAGE_DIR, key);
  if (abs !== STORAGE_DIR && !abs.startsWith(STORAGE_DIR + path.sep)) return false;
  try {
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return false;
    fs.unlinkSync(abs);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  // 1. Demo testlar + audio fayllar
  const demoTests = await prisma.test.findMany({
    where: { isDemo: true },
    select: { id: true, title: true, questions: { select: { audioUrl: true } } },
  });
  let files = 0;
  for (const t of demoTests) {
    for (const q of t.questions) {
      // audioUrl storage key (`tests/<file>`) yoki endpoint (`/v1/tests/...`) bo'lishi mumkin.
      const key = q.audioUrl && !q.audioUrl.startsWith('/v1/') ? q.audioUrl : null;
      if (safeUnlink(key)) files += 1;
    }
  }
  const delTests = await prisma.test.deleteMany({ where: { isDemo: true } });

  // 2. Demo mocklar + media fayllar
  const demoMocks = await prisma.mockExam.findMany({
    where: { isDemo: true },
    select: {
      id: true,
      title: true,
      sections: {
        select: { groups: { select: { audioKey: true, imageKey: true } } },
      },
      attempts: { select: { answers: { select: { audioKey: true } } } },
    },
  });
  for (const m of demoMocks) {
    for (const s of m.sections) {
      for (const g of s.groups) {
        if (safeUnlink(g.audioKey)) files += 1;
        if (safeUnlink(g.imageKey)) files += 1;
      }
    }
    for (const a of m.attempts) {
      for (const ans of a.answers) {
        if (safeUnlink(ans.audioKey)) files += 1;
      }
    }
  }
  const delMocks = await prisma.mockExam.deleteMany({ where: { isDemo: true } });

  console.log(`O'chirildi: ${delTests.count} ta demo test, ${delMocks.count} ta demo mock.`);
  console.log(`Storage'dan ${files} ta fayl tozalandi.`);
  if (delTests.count > 0) {
    console.log('Testlar:', demoTests.map((t) => `"${t.title}"`).join(', '));
  }
  if (delMocks.count > 0) {
    console.log('Mocklar:', demoMocks.map((m) => `"${m.title}"`).join(', '));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
