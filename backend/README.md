# O'quv Markaz Platformasi — Backend

**NestJS 10 + PostgreSQL 17 + Prisma 5** asosidagi to'liq API. `api-contract.md` kontraktiga mos.
Bitta o'quv markazning kundalik ishini — o'quvchilar, guruhlar, davomat, to'lov, ball (reyting), test/mock imtihon, video darslar, bildirishnoma va statistikani — bitta joyda, rol bo'yicha himoyalangan holda yuritadi.

> **Ikki repodan iborat loyiha.** Bu — backend (API + admin panel). Web interfeys (o'quvchi/o'qituvchi/ota-ona
> uchun) alohida repoda: **[bestway-frontend](https://github.com/Hamroqulovv/bestway-frontend)** (Next.js 16).
> Backendni **birinchi** ishga tushiring — frontend shu API'ga ulanadi.
>
> 🚀 **Yangi boshlayapsizmi? [`SETUP.md`](./SETUP.md)** ni o'qing — 0 dan ishga tushirishgacha qadamma-qadam qo'llanma.

---

## Mundarija

1. [Asosiy tamoyillar](#1-asosiy-tamoyillar)
2. [Texnologiyalar va arxitektura](#2-texnologiyalar-va-arxitektura)
3. [Talablar](#3-talablar)
4. [Ishga tushirish (0 dan)](#4-ishga-tushirish-0-dan)
5. [Muhit o'zgaruvchilari (`.env`)](#5-muhit-ozgaruvchilari-env)
6. [Akkauntlar va seed](#6-akkauntlar-va-seed)
7. [Autentifikatsiya va rollar (RBAC)](#7-autentifikatsiya-va-rollar-rbac)
8. [Javob va xatolik formati](#8-javob-va-xatolik-formati)
9. [Modullar](#9-modullar)
10. [Test moduli (`/tests`)](#10-test-moduli-tests)
11. [Real Mock imtihon moduli (`/mock`)](#11-real-mock-imtihon-moduli-mock)
12. [Video darslar](#12-video-darslar)
13. [Telegram bot](#13-telegram-bot)
14. [Admin panel](#14-admin-panel)
15. [Ma'lumotlar bazasi sxemasi](#15-malumotlar-bazasi-sxemasi)
16. [npm skriptlari](#16-npm-skriptlari)
17. [Loyiha tuzilishi](#17-loyiha-tuzilishi)
18. [Muhim biznes-qoidalar (kodda qayerda)](#18-muhim-biznes-qoidalar-kodda-qayerda)
19. [Testlash](#19-testlash)
20. [Zaxira nusxa (backup)](#20-zaxira-nusxa-backup)
21. [Prodakshanga chiqarish](#21-prodakshanga-chiqarish)
22. [Kelajak (Phase 2)](#22-kelajak-phase-2)

---

## 1. Asosiy tamoyillar

- **Onlayn to'lov integratsiyasi yo'q** — to'lovlar admin tomonidan qo'lda belgilanadi (`method: "manual"`), lekin arxitektura kelajakda provayder qo'shishga tayyor.
- **Rol bo'yicha himoya** — har bir endpoint rolga bog'langan; o'qituvchi **faqat o'z guruhini**, ota-ona **faqat farzandini** ko'radi (va faqat o'qiy oladi).
- **Audit jurnali** — muhim o'zgarishlar (ball, to'lov, davomat, rol, video/mock) yoziladi; faqat super admin ko'radi.
- **Himoyalangan media** — video fayllarga to'g'ridan-to'g'ri havola berilmaydi: har safar **muddati cheklangan imzolangan token** beriladi.
- **Bitta javob formati** — barcha muvaffaqiyatli javoblar `{ success, data }`, xatolar `{ success:false, error:{ code, message } }`.
- **Almashtiriladigan qatlamlar** — disk saqlash (`StorageService`) va bildirishnoma (Telegram) kelajakda S3/CDN yoki boshqa kanalga oson ko'chiriladi.

## 2. Texnologiyalar va arxitektura

| Qatlam | Texnologiya |
|---|---|
| Runtime | Node.js 20+ (24 sinovdan o'tgan) |
| Framework | NestJS 10 (modulli: har modul controller + service + dto) |
| ORM / Baza | Prisma 5 / PostgreSQL 17 |
| Auth | JWT (access + refresh), `bcryptjs` bilan parol hashi |
| Validatsiya | `class-validator` + global `ValidationPipe` (`whitelist`, `transform`) |
| Xavfsizlik | `helmet` (statik fayllardan oldin), CORS, `@nestjs/throttler` rate-limit |
| Hujjat | Swagger/OpenAPI — `/docs` |
| PDF | `pdfkit` (sertifikatlar, tashqi servissiz) |
| Rejalashtirish | `@nestjs/schedule` (oylik ball reset cron) |

**Global qatlamlar** (`app.module.ts` da `APP_GUARD`/`APP_INTERCEPTOR`/`APP_FILTER`):

```
So'rov  →  ThrottlerGuard  →  JwtAuthGuard  →  RolesGuard  →  Controller
Javob   ←  TransformInterceptor (envelope)  ←  AllExceptionsFilter (xatolik)
```

- **Base URL:** barcha marshrutlar `/v1` prefiksi bilan (`app.setGlobalPrefix('v1')`).
- **Global modullar** (`@Global`, hamma joyda in'ektsiya qilinadi): `PrismaModule`, `AccessModule` (RBAC), `AuditModule`, `NotificationsModule`, `TelegramModule`, `SettingsModule`.

## 3. Talablar

| Dastur | Versiya |
|---|---|
| Node.js | 20+ (24 sinovdan o'tgan) |
| PostgreSQL | 14+ (17 sinovdan o'tgan) |
| npm | 10+ |

## 4. Ishga tushirish (0 dan)

```bash
cd backend
npm install

# 1) Sozlamalar faylini yarating
cp .env.example .env
#    .env ichida JWT_SECRET va STREAM_TOKEN_SECRET ni albatta o'zgartiring!

# 2) Bazani yarating (agar hali bo'lmasa)
#    Windows: "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "CREATE DATABASE education_center"
#    Linux:   createdb education_center

# 3) Jadvallarni yarating (migratsiyalarni qo'llash)
npx prisma migrate deploy

# 4a) REAL boshlanish — faqat sozlamalar + super admin (.env dagi ma'lumotlar bilan)
npm run seed:init
#  yoki
# 4b) DEMO ma'lumot (test akkauntlari, guruh, testlar, maqolalar) — faqat dev uchun
# npm run seed
# 4c) (ixtiyoriy) To'liq IELTS mock imtihon namunasi
# npm run seed:mock

# 5) Serverni ishga tushiring
npm run start:dev
```

| Manzil | Tavsif |
|---|---|
| **http://localhost:3001/v1** | API (base URL) |
| **http://localhost:3001/admin** | Admin panel (markaz xodimlari) |
| **http://localhost:3001/docs** | Swagger hujjati (dasturchi) |
| **http://localhost:3001/v1/health** | Salomatlik tekshiruvi → `{ success:true, data:{ status:"ok" } }` |

### Docker bilan

```bash
docker compose up -d      # postgres + api (migratsiya avtomatik qo'llanadi)
```

`Dockerfile` ikki bosqichli (build → runtime), `public/admin/` ni ham nusxalaydi, ishga tushganda `npx prisma migrate deploy` bajaradi.

## 5. Muhit o'zgaruvchilari (`.env`)

| O'zgaruvchi | Ma'nosi |
|---|---|
| `DATABASE_URL` | PostgreSQL ulanish satri |
| `PORT` | Server porti (standart 3001) |
| `CORS_ORIGIN` | Frontend manzili (vergul bilan bir nechta) |
| `PUBLIC_URL` | Backendning tashqi manzili — video/audio havolalari shu asosda quriladi |
| `JWT_SECRET` | **Majburiy.** Access token kaliti |
| `JWT_ACCESS_TTL` | Access token muddati (standart `15m`) |
| `JWT_REFRESH_TTL_DAYS` | Refresh token muddati (standart 30 kun) |
| `STREAM_TOKEN_SECRET` | Video havolalarini imzolash kaliti |
| `STREAM_URL_TTL_SECONDS` | Video havolasi amal qilish muddati (standart 3600) |
| `STORAGE_DIR` | Fayllar papkasi (`videos/`, `thumbnails/`, `teachers/`, `mock/`) |
| `MAX_UPLOAD_MB` | Maksimal yuklash hajmi — video va mock audio uchun (standart 500 MB) |
| `TELEGRAM_BOT_TOKEN` | Ixtiyoriy — bo'lsa bildirishnomalar Telegramga ham ketadi |
| `TELEGRAM_BOT_USERNAME` | Deep link uchun bot nomi (bo'sh bo'lsa `getMe` orqali aniqlanadi) |
| `TELEGRAM_MODE` | `polling` (standart) \| `webhook` \| `off` |
| `TELEGRAM_WEBHOOK_URL` / `TELEGRAM_WEBHOOK_SECRET` | Faqat `webhook` rejimida |
| `TELEGRAM_LINK_TTL_MINUTES` | Bog'lash havolasi muddati (standart 10) |
| `CENTER_NAME` | Sertifikat PDF'sida chiqadigan markaz nomi |
| `SEED_SUPER_ADMIN_NAME` / `_PHONE` / `_PASSWORD` | `seed:init` yaratadigan super admin |

## 6. Akkauntlar va seed

Uchta seed skripti bor — vazifasi turlicha:

| Skript | Nima yaratadi | Qachon |
|---|---|---|
| `npm run seed:init` | Sozlamalar + **faqat** super admin (`.env` dan). Idempotent. | **Prodakshan** boshlanishi |
| `npm run seed` | Demo: test akkauntlari, guruh, testlar, maqolalar | Faqat **dev** |
| `npm run seed:mock` | To'liq IELTS Academic mock imtihon namunasi (4 bo'lim, 19 savol) | Ixtiyoriy demo |

### Demo akkauntlar (`npm run seed`) — faqat dev!

| Rol | Telefon | Parol |
|---|---|---|
| super_admin | `.env` dagi `SEED_SUPER_ADMIN_PHONE` | `.env` dagi parol |
| admin | `+998900000002` | `Admin123!` |
| teacher | `+998900000003` | `Teacher123!` |
| student (tasdiqlangan) | `+998900000010` | `Student123!` |
| student | `+998900000011` | `Student123!` |
| parent | `+998900000020` | `Parent123!` |

> ⚠️ Prodakshan bazasida `npm run seed` ni **ishlatmang** — u ochiq parolli demo akkauntlar yaratadi. Prodakshan uchun faqat `seed:init`.

## 7. Autentifikatsiya va rollar (RBAC)

**JWT oqimi:** `POST /v1/auth/login` → `{ accessToken, refreshToken, user }`. Har so'rovda `Authorization: Bearer <accessToken>`. Access eskirsa `POST /v1/auth/refresh` bilan yangilanadi (faqat yangi access qaytadi). `logout` refresh tokenni bekor qiladi.

**Rollar:** `super_admin` · `admin` · `teacher` · `student` · `parent` (+ ro'yxatdan o'tmagan **mehmon**).

| Rol | Huquqlar |
|---|---|
| **super_admin** | Hammasi + audit jurnali + o'chirish (delete) huquqlari |
| **admin** | Kundalik boshqaruv: o'quvchi/guruh/to'lov/davomat/test/mock/video/maqola |
| **teacher** | Faqat **o'z guruhi**: davomat, cheklangan ball (±limit), Writing/Speaking baholash |
| **student** | Test/mock topshiradi, o'z natija/davomat/to'lov/ballini ko'radi, video ko'radi |
| **parent** | Faqat **farzandi** ma'lumotini o'qiydi |
| **mehmon** | Ochiq sahifalar, maqolalar, demo test/mock |

**RBAC qatlamlari (`src/common/`):**
- `@Roles(...)` dekoratori + `RolesGuard` — endpoint darajasida rol tekshiruvi.
- `@Public()` / `@OptionalAuth()` — auth shart emas / token bo'lsa aniqlanadi (mehmon rejimi).
- `AccessService.assertCanViewStudent()` — obyekt darajasida: o'qituvchi faqat o'z guruhi o'quvchisini, ota-ona faqat farzandini ko'radi.

## 8. Javob va xatolik formati

Barcha javoblar `TransformInterceptor` orqali bitta shaklga o'raladi:

```jsonc
// Muvaffaqiyat
{ "success": true, "data": { /* ... */ } }
// Ro'yxat (paginatsiya)
{ "success": true, "data": [ /* ... */ ], "meta": { "page": 1, "limit": 20, "total": 42 } }
// Xatolik (AllExceptionsFilter)
{ "success": false, "error": { "code": "TEST_NOT_FOUND", "message": "Test topilmadi" } }
```

- **Paginatsiya so'rovi:** `?page=1&limit=20` (`limit` maksimal 100).
- **Rate-limit:** IP bo'yicha 300 so'rov/daqiqa (login 30/daq, register 10/daq) → `429 TOO_MANY_REQUESTS`.
- To'liq xatolik kodlari ro'yxati — `api-contract.md` (bo'lim: *Xatolik kodlari*).

## 9. Modullar

| Modul | Base path | Vazifasi |
|---|---|---|
| `auth` | `/v1/auth` | register, login, refresh, logout, link-child, me |
| `users` | `/v1/users` | Foydalanuvchilar CRUD, parol tiklash, deaktivatsiya |
| `groups` | `/v1/groups` | Guruhlar, o'qituvchi biriktirish, o'quvchi qo'shish/chiqarish |
| `attendance` | `/v1/attendance` | Davomat (present/late/absent), bulk, statistika |
| `payments` | `/v1/payments` | Oylik to'lov (qo'lda), qarzdorlar, eslatma |
| `points` | `/v1/points` | Ball qo'shish/ayirish (sabab majburiy), reyting |
| `game` | `/v1/game` | Oylik o'yin: chegara ballga yetganlar, oylik reset (cron) |
| `tests` | `/v1/tests` | Klassik test: yaratish, topshirish, avto+qo'lda baholash, sertifikat |
| **`mock`** | `/v1/mock` | **Real IELTS/Multilevel mock imtihon (band/CEFR baholash)** |
| `videos` | `/v1/videos` | Video yuklash, imzolangan oqim, qo'lda tasdiqlanadigan xarid |
| `articles` | `/v1/articles` | Rasmiy sayt maqolalari/yangiliklari |
| `teachers` | `/v1/teachers` | Saytdagi "professional o'qituvchilar" kartochkalari (marketing) |
| `notifications` | `/v1/notifications` | In-app bildirishnoma + ommaviy e'lon (broadcast) |
| `telegram` | `/v1/telegram` | Bot: deep-link bog'lash, rolga qarab menyu, polling/webhook |
| `stats` | `/v1/stats` | Dashboard statistikasi + CSV eksport |
| `settings` | `/v1/settings` | Tizim sozlamalari (ball limiti, boshlang'ich ball, ...) |
| `audit` | `/v1/audit-logs` | Audit jurnali (faqat super admin) |

Har bir modul: `*.controller.ts` (marshrutlar + rollar), `*.service.ts` (biznes-mantiq), `dto/` (validatsiya).

## 10. Test moduli (`/tests`)

Klassik "oddiy mock" — IELTS/Multilevel test bazasi. Tuzilma: **Test → Question** (bo'lim + tur).

- **Turlar:** `TestType = ielts | multilevel`; **bo'limlar** `listening | reading | writing | speaking`.
- **Avto baholash:** listening/reading — `correctAnswer` (variantlar `|` bilan). **Qo'lda:** writing/speaking (o'qituvchi).
- **Tasodifiylik:** har urinishda savollar `sectionQuestionCounts` bo'yicha tasodifiy tanlanadi va aralashtiriladi (nusxa ko'chirishga qarshi).
- **Anti-cheat:** tab almashtirish (`visibilitychange`) backendga signal sifatida yoziladi.
- **Natija:** xom ball (`autoScore + manualScore = totalScore`) + PDF sertifikat.
- **Resume:** tugallanmagan urinish bo'lsa — davom ettiriladi (`savedAnswers` bilan).

To'liq endpointlar — `api-contract.md` A.7.

## 11. Real Mock imtihon moduli (`/mock`)

Klassik `/tests` dan **alohida, mustaqil** modul (`src/mock/`) — real IELTS/Multilevel mock imtihon uchun. O'ziga xos `Mock*` jadvallaridan foydalanadi, mavjud test tizimiga tegmaydi.

**Tuzilma:** `Exam → Section (skill) → QuestionGroup (matn/audio/ko'rsatma) → Question`

**Enumlar:**
- `MockExamType`: `ielts_academic | ielts_general | multilevel`
- `MockSkill`: `listening | reading | writing | speaking`
- `MockQuestionType` (15 ta): `multiple_choice, multi_select, true_false_notgiven, yes_no_notgiven, matching, matching_headings, sentence_completion, note_completion, summary_completion, table_completion, short_answer, map_labelling, essay_task1, essay_task2, speaking_task`
- `MockAttemptStatus`: `in_progress | grading | completed`

**Imkoniyatlar:**
- **Reading matnlari & Listening audio** — har blok (group) o'z matni/audiosi/ko'rsatmasi bilan. Audio yuklash + Range bilan oqim (`GET /mock/groups/:id/audio`).
- **Band baholash** — listening/reading xom bali standart jadval bo'yicha IELTS bandga (0–9, 0.5 qadam) aylanadi. Writing bandi `(task1 + 2·task2)/3`. `overallBand` = 4 bo'lim o'rtachasi (0.5 ga yaxlitlangan). CEFR banddan chiqariladi.
- **Multilevel** — band emas, umumiy foizdan CEFR (`A1..C1`) aniqlanadi.
- **Aqlli avto-baholash** — registr/probel/tinish belgisiga sezgir emas, boshidagi `a/an/the` ixtiyoriy, raqam↔so'z ekvivalent (`"3"=="three"`), `multi_select` uchun to'plam mosligi.
- **Kuchli savol/javob kiritish** — bir so'rovda bir nechta savol + javob kaliti (`POST /mock/groups/:id/questions`).
- **Anti-cheat, resume, rol bo'yicha ko'rinish** (mehmon→demo, o'quvchi→published, xodim→hammasi), o'quvchiga `correctAnswers` **yuborilmaydi**.

**v2 imkoniyatlar:**
- **Moslashuvchan bo'limlar** — istalgan kombinatsiya (faqat Reading, yoki Writing+Speaking...). Speaking'ni skip qilsa bo'ladi; Writing/Speaking o'qituvchiga (grading) boradi.
- **Speaking audio** — o'quvchi ovozini yuklaydi (`POST /mock/attempts/:id/speaking/:qid`); o'qituvchi tinglab band qo'yadi.
- **Pullik kirish** — oddiy userlar mockni **sotib olib** ishlatadi (video kabi qo'lda tasdiq): `price`, `access: granted|pending|locked`, `purchase` / `confirm-purchase`.
- **Vaqtli / vaqtsiz rejim** — `start { mode: "practice" | "timed" }`; timed'da `deadlineAt` enforce qilinadi (frontend: full ekran + taymer).
- **Savolni paste qilib import** — matnni tashlaysiz → tizim savollarga ajratadi (`/mock/parse-questions`), javob kalitini raqam bo'yicha berasiz (`.../questions/import`). Teacher ham mock qo'sha oladi.
- **Highlight/annotatsiya** saqlanadi; urinish tugagach o'quvchi o'z **to'g'ri javoblarini** ko'radi.

**Asosiy oqim:**
```
Admin/Teacher: POST /mock/exams → /exams/:id/sections → /sections/:id/groups → /groups/:id/questions
         (yoki /groups/:id/questions/import — paste+javob kaliti)
         (+ /groups/:id/media  audio/rasm yuklash) → PATCH /exams/:id { isPublished:true }
O'quvchi: POST /mock/exams/:id/start → /attempts/:id/answers → /attempts/:id/submit
O'qituvchi: POST /mock/attempts/:id/grade  (Writing/Speaking band)
Natija:  GET /mock/attempts/:id  (band/CEFR) · GET /mock/attempts/:id/certificate (PDF)
```

To'liq endpointlar va qoidalar — `api-contract.md` A.7b. Namuna: `npm run seed:mock`.

**Fayllar (`src/mock/`):** `mock-scoring.ts` (band/CEFR jadvallar), `mock-answer.ts` (moslik), `mock-parse.ts` (paste→savol parser), `mock-shape.ts` (javob shakli), `mock-access.service.ts` (pullik kirish/xarid), `mock-authoring.service.ts` (CRUD + media + import), `mock-attempt.service.ts` (oqim + rejim + speaking), `mock-grading.service.ts` (baholash + band), `mock-certificate.service.ts` (PDF), `mock.controller.ts`, `mock.module.ts`, `dto/mock.dto.ts`.

## 12. Video darslar

- Yuklash: `multipart/form-data` (`file` + ixtiyoriy `thumbnail`), fayllar diskka yoziladi.
- **Kirish nazorati:** to'g'ridan-to'g'ri havola yo'q. `GET /videos/:id/stream-url` huquqni tekshirib **muddati cheklangan imzolangan token** beradi; `GET /videos/stream?token=` Range bilan oqim.
- **Xarid:** o'quvchi so'rov qoldiradi (`pending_confirmation`), admin qo'lda tasdiqlaydi. "Tasdiqlangan o'quvchi" ga `isFreeForApproved` videolar bepul.
- Almashtirish uchun tayyor: `StorageService` ni S3/Bunny Stream'ga o'zgartirilsa qolgan kod tegilmaydi.

## 13. Telegram bot

Bot xabar yuborishi uchun **foydalanuvchi Telegram akkaunti sayt akkaunti bilan bog'langan** bo'lishi kerak. Bir martalik token orqali:

```
Sayt: POST /v1/telegram/link-token → { url: "https://t.me/BOT?start=<token>" }
Telegram: foydalanuvchi bosadi → bot chat.id ni oladi → user.telegramChatId ✅
```

Token **1 marta**, 10 daqiqada eskiradi. Zaxira yo'l: botga `/start` yozib o'z **telefon raqamini** ulash (backend `phone` bilan solishtiradi).

**Sozlash:**
1. [@BotFather](https://t.me/BotFather) → `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`.
2. Dev/oddiy server: `TELEGRAM_MODE=polling` (domen/HTTPS shart emas).
3. Prodakshan: `TELEGRAM_MODE=webhook` + `TELEGRAM_WEBHOOK_URL` + `TELEGRAM_WEBHOOK_SECRET` (server ko'tarilganda avtomatik ro'yxatdan o'tadi).

Buyruqlar: `/start`, `/menu`, `/status`, `/unlink`, `/help`. Menyu **rolga qarab** o'zgaradi (o'quvchi: ballar/davomat/to'lov/natija; ota-ona: farzandlar; o'qituvchi: guruhlar/baholash; admin: bugungi holat/qarzdorlar). `TELEGRAM_BOT_TOKEN` bo'sh bo'lsa bot o'chiq, in-app bildirishnoma baribir ishlaydi.

Terminaldan bog'lash (panelsiz sinash): `npm run tg:link` yoki `npm run tg:link -- +998901234567 parol`.

## 14. Admin panel

Backend o'zi bilan **tayyor boshqaruv panelini** olib yuradi: `http://localhost:3001/admin`. Alohida build/frontend kerak emas — statik fayllar (`public/admin/`) + shu API. Faqat `admin` va `super_admin` kira oladi.

| Bo'lim | Nima qila oladi |
|---|---|
| **Bosh sahifa** | O'quvchi/guruh soni, bugungi davomat, oylik tushum, qarzdorlar, navbatdagi ishlar, 6 oylik grafik |
| **O'quvchilar** | Qidiruv/filtr, qo'shish, tahrirlash, parol tiklash, tasdiqlash, ota-ona kodi, deaktivatsiya, CSV |
| **Xodimlar** | O'qituvchi/admin/ota-ona qo'shish va tahrirlash |
| **Guruhlar** | Yaratish, o'qituvchi biriktirish, o'quvchilar |
| **Davomat** | Guruh + sana bo'yicha bir ekranda belgilash, CSV |
| **To'lovlar** | Oylik jadval, holat, summa avtomatik, qarzdorlarga eslatma, CSV |
| **Ballar** | Qo'shish/ayirish (sabab majburiy), tarix, reyting |
| **O'yin** | Oylik o'yinga qo'shilganlar, oy tanlash, CSV |
| **Baholash** | Writing/Speaking navbati, anti-cheat belgisi |
| **Videolar** | Yuklash, narx, xaridni tasdiqlash |
| **Maqolalar** | Sayt yangiliklarini yozish/tahrirlash |
| **Xabar yuborish** | Hammaga/rol/guruh/qarzdorlarga e'lon (Telegramga ham) |
| **Sozlamalar** | Ball limiti, boshlang'ich ball, oylik to'lov, o'yin chegarasi, Telegram ulash |
| **Audit jurnali** | Kim nimani o'zgartirgani (faqat super admin) |

## 15. Ma'lumotlar bazasi sxemasi

Prisma sxemasi: `prisma/schema.prisma`. Modellar guruhlangan:

| Guruh | Modellar |
|---|---|
| **Foydalanuvchilar** | `User`, `StudentProfile`, `ParentStudent`, `RefreshToken`, `TelegramLinkToken` |
| **Guruh & kundalik** | `Group`, `Attendance`, `Payment`, `PointsLog`, `MonthlyPointsArchive` |
| **Test (klassik)** | `Test`, `Question`, `TestAttempt`, `Answer`, `AntiCheatEvent` |
| **Mock (yangi)** | `MockExam`, `MockSection`, `MockQuestionGroup`, `MockQuestion`, `MockAttempt`, `MockAnswer`, `MockCheatEvent`, `MockPurchase` |
| **Kontent** | `VideoLesson`, `VideoPurchase`, `Article`, `Teacher` |
| **Tizim** | `Notification`, `AuditLog`, `Setting` |

**Enumlar:** `Role`, `AttendanceState`, `PaymentState`, `PaymentMethod`, `TestType`, `TestSection`, `QuestionType`, `AttemptStatus`, `NotificationType`, `PurchaseStatus`, `MockExamType`, `MockSkill`, `MockQuestionType`, `MockAttemptStatus`, `MockAttemptMode`.

**Migratsiyalar** (`prisma/migrations/`): `init` → `telegram_link` → `announcement_and_monthly_fee` → `game_points_monthly` → `add_teachers_marketing` → `mock_exam_system` → `mock_paid_mode_speaking`.

Foydali buyruqlar:
```bash
npx prisma migrate dev --name <nom>   # yangi migratsiya (dev)
npx prisma migrate deploy             # migratsiyalarni qo'llash (prod)
npx prisma generate                   # klientni qayta yaratish
npm run prisma:studio                 # bazani vizual ko'rish
```

## 16. npm skriptlari

| Skript | Vazifasi |
|---|---|
| `npm run start:dev` | Ishlab chiqish rejimi (o'zgarishlarni kuzatadi) |
| `npm run start:prod` | Prodakshan (avval `npm run build`) |
| `npm run build` | TypeScript → `dist/` |
| `npm run seed:init` | **Real:** sozlamalar + super admin |
| `npm run seed` | **Demo:** test akkauntlari, guruh, testlar (faqat dev) |
| `npm run seed:mock` | To'liq IELTS mock imtihon namunasi |
| `npm run prisma:migrate` / `:deploy` / `:generate` | Prisma migratsiya/generatsiya |
| `npm run prisma:studio` | Bazani vizual ko'rish |
| `npm run test:smoke` | To'liq API smoke-testi |
| `npm run tg:link` | Telegram bog'lash havolasi |
| `npm run db:backup` | Baza zaxirasi |

## 17. Loyiha tuzilishi

```
prisma/
  schema.prisma          # Baza sxemasi (enumlar kontraktdagidek)
  migrations/            # Migratsiya tarixi
  seed.ts                # Demo ma'lumot
  seed-init.ts           # Prodakshan: faqat super admin
  seed-mock.ts           # To'liq IELTS mock namunasi
public/admin/            # Admin panel (statik: index.html, app.js, styles.css)
src/
  common/                # Envelope, xatolik filtri, guardlar, RBAC, access-service, date.util
  prisma/ audit/ settings/ notifications/ telegram/   # Global modullar
  auth/                  # register, login, refresh, logout, link-child, me
  users/ groups/                                       # Odamlar va guruhlar
  attendance/ payments/ points/ game/                  # Kundalik ish + oylik o'yin
  tests/                 # Klassik test (avto+qo'lda baholash, sertifikat)
  mock/                  # Real IELTS/Multilevel mock (band/CEFR, passage/audio)
  videos/                # Yuklash, imzolangan oqim, qo'lda tasdiqlanadigan xarid
  articles/ teachers/    # Sayt kontenti (maqolalar, o'qituvchi kartochkalari)
  stats/                 # Dashboard + CSV eksport
scripts/
  backup.sh / backup.ps1   # Kunlik zaxira
  smoke-test.mjs           # API smoke-test
  telegram-link.mjs        # Telegram bog'lash CLI
```

## 18. Muhim biznes-qoidalar (kodda qayerda)

| Qoida | Fayl |
|---|---|
| Yangi o'quvchiga 100 ball | `auth/auth.service.ts` (`initialPoints` sozlamasi) |
| Ball o'zgarishi sababsiz bo'lmaydi + jurnal + bildirishnoma | `points/points.service.ts` |
| O'qituvchi ball limiti (±20, super admin o'zgartiradi) | `points/points.service.ts` + `settings/` |
| Ball har oy avtomatik boshlang'ichga qaytadi (o'tgan oy arxivlanadi) | `game/game.service.ts` (`monthlyReset` cron) |
| Chegara ballga yetgan o'quvchi oylik o'yinga qo'shiladi | `game/game.service.ts` (`checkAndQualify`) |
| "Tasdiqlangan o'quvchi" → videolar bepul | `videos/videos.service.ts` (`accessFor`) |
| Test: har urinishda savollar tasodifiy | `tests/tests.service.ts` (`shuffle`) |
| Test/mock: tab almashtirish qayd etiladi | `tests/tests.service.ts`, `mock/mock-attempt.service.ts` (`flagCheat`) |
| Writing/Speaking faqat o'qituvchi baholaydi | `tests/tests.service.ts` (`MANUAL_SECTIONS`), `mock/mock-scoring.ts` (`MANUAL_SKILLS`) |
| Mock: IELTS band / CEFR hisoblash | `mock/mock-scoring.ts` (`bandFromRaw`, `overallBand`, `cefrFromPercent`) |
| Mock: aqlli javob mosligi (raqam↔so'z, artikl) | `mock/mock-answer.ts` (`isAnswerCorrect`) |
| To'lov faqat qo'lda | `payments/payments.service.ts` |
| Video havolasi imzolanadi va eskiradi | `videos/stream-token.service.ts` |
| Telegram akkauntini bir martalik token bilan bog'lash | `telegram/telegram-link.service.ts` |
| Davomat sanasi UTC yarim tunda saqlanadi | `common/date.util.ts` |

## 19. Testlash

Server ishlab turgan holda, **toza seed qilingan dev bazasida**:

```bash
npm run test:smoke
```

Barcha endpointlar, RBAC chegaralari, ball limiti, anti-cheat, video oqimi, sertifikat PDF, bildirishnoma va audit jurnalini tekshiradi. **Skript bazaga yozadi — prodakshanda ishlatmang.**

Telegram bog'lash oqimini ham (haqiqiy botsiz) tekshirish uchun serverni webhook rejimida qo'yib, `SMOKE_TELEGRAM_SECRET=secret npm run test:smoke` ishga tushiring.

Mock modulining band hisoblashi va to'liq oqimi (start → answer → submit → grade → band natija → sertifikat) alohida uchdan-uchgacha (e2e) tekshiruvdan o'tgan.

## 20. Zaxira nusxa (backup)

**Linux (cron, har kuni 02:00):**
```
0 2 * * * /bin/bash /path/to/backend/scripts/backup.sh >> /var/log/edu-backup.log 2>&1
```

**Windows (Task Scheduler):**
```powershell
schtasks /Create /SC DAILY /ST 02:00 /TN "EduCenterBackup" `
  /TR "powershell -ExecutionPolicy Bypass -File C:\...\backend\scripts\backup.ps1"
```

Ikkalasi ham 14 kundan eski nusxalarni avtomatik o'chiradi (`KEEP_DAYS`).

## 21. Prodakshanga chiqarish

1. `.env` da **yangi** `JWT_SECRET` va `STREAM_TOKEN_SECRET` (`openssl rand -hex 32`).
2. `CORS_ORIGIN` va `PUBLIC_URL` ni haqiqiy domenlarga qo'ying.
3. `npm run build && npx prisma migrate deploy && npm run start:prod`.
4. Oldiga **nginx/Caddy** qo'ying (HTTPS + `client_max_body_size` video/audio hajmiga mos).
5. `scripts/backup.*` ni jadvalga qo'ying, nusxalarni boshqa diskka/serverga ko'chiring.
6. Media ko'paysa — `videos/storage.service.ts` ni S3/Bunny Stream'ga almashtiring (kirish nazorati alohida qatlamda, qolgan kod tegilmaydi).
7. `TELEGRAM_MODE=webhook` (HTTPS bilan), `seed:init` (demo emas).

## 22. Kelajak (Phase 2)

- **2FA:** `User` modelida qo'shimcha maydon + `auth.service.ts` da bitta tekshiruv qadami.
- **Onlayn to'lov:** `Payment.method` enumiga yangi qiymat; qo'lda mantiq tegilmaydi, yoniga provayder qo'shiladi.
- **CDN/S3:** faqat `StorageService` almashtiriladi.
- **Mock frontend:** `/mock` API kontrakti tayyor (`api-contract.md` A.7b); frontend UI shu asosda ulanadi.

---

**Dasturchi uchun:** to'liq endpoint kontrakti — [`api-contract.md`](./api-contract.md), interaktiv hujjat — [`/docs`](http://localhost:3001/docs) (Swagger).
