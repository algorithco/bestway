/**
 * Telegram bog'lash havolasini terminalda olish (frontend hali tayyor bo'lmaganda qulay).
 *
 *   npm run tg:link                      -> .env dagi super admin uchun
 *   npm run tg:link -- +998901234567 parol   -> boshqa foydalanuvchi uchun
 *
 * Chiqqan havolani brauzerda/telefonda oching → botda "Start" bosing → akkaunt bog'lanadi.
 */
import 'dotenv/config';

const BASE = process.env.SMOKE_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3001}/v1`;
const phone = process.argv[2] ?? process.env.SEED_SUPER_ADMIN_PHONE;
const password = process.argv[3] ?? process.env.SEED_SUPER_ADMIN_PASSWORD;

if (!phone || !password) {
  console.error("Telefon va parol topilmadi. .env da SEED_SUPER_ADMIN_* ni to'ldiring yoki argument bering.");
  process.exit(1);
}

const post = async (path, body, token) => {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json();
  if (!json.success) throw new Error(`${path}: ${json.error?.code} — ${json.error?.message}`);
  return json.data;
};

try {
  const { accessToken, user } = await post('/auth/login', { phone, password });
  const { url, expiresAt } = await post('/telegram/link-token', null, accessToken);

  console.log(`\n  Foydalanuvchi: ${user.name} (${user.role})`);
  console.log(`  Havola:        ${url}`);
  console.log(`  Amal qiladi:   ${new Date(expiresAt).toLocaleTimeString()} gacha\n`);
  console.log('  Havolani oching → botda "Start" bosing → bog\'lanish tayyor.\n');
} catch (e) {
  console.error(`\n  Xatolik: ${e.message}`);
  console.error('  Server ishlab turganini tekshiring: npm run start:dev\n');
  process.exit(1);
}
