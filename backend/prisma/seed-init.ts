/**
 * Prodakshan seed — HECH QANDAY demo ma'lumot yaratmaydi.
 * Faqat: tizim sozlamalari + bitta super admin akkaunt.
 *
 * Ishga tushirish: npm run seed:init
 * Idempotent: qayta ishga tushirilsa dublikat yaratmaydi va parolni o'zgartirmaydi.
 *
 * Demo ma'lumot kerak bo'lsa (dev uchun): npm run seed
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  const phone = process.env.SEED_SUPER_ADMIN_PHONE;
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
  const name = process.env.SEED_SUPER_ADMIN_NAME || 'Super Admin';

  if (!phone || !password) {
    throw new Error('.env da SEED_SUPER_ADMIN_PHONE va SEED_SUPER_ADMIN_PASSWORD ko\'rsatilmagan');
  }

  // --- Tizim sozlamalari ---
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

  // --- Super admin ---
  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    console.log(`Super admin allaqachon mavjud: ${phone} (parol o'zgartirilmadi)`);
  } else {
    await prisma.user.create({
      data: {
        name,
        phone,
        passwordHash: await bcrypt.hash(password, 10),
        role: 'super_admin',
      },
    });
    console.log(`Super admin yaratildi: ${phone}`);
  }

  const counts = {
    foydalanuvchi: await prisma.user.count(),
    guruh: await prisma.group.count(),
    test: await prisma.test.count(),
  };
  console.log('Bazadagi yozuvlar:', counts);
  console.log("\nTayyor. Endi tizimga super admin sifatida kiring va admin/o'qituvchi qo'shing.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
