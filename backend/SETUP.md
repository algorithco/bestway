# Setup qo'llanma — Backend (0 dan ishga tushirish)

Bu qo'llanma **bo'sh kompyuterdan** boshlab backendni ishga tushirishgacha bo'lgan har bir qadamni
ko'rsatadi. Batafsil ma'lumot (modullar, biznes-qoidalar, arxitektura) uchun — [`README.md`](./README.md).

> Frontend (web interfeys) alohida repoda: **[bestway-frontend](https://github.com/Hamroqulovv/bestway-frontend)**.
> **Avval shu backendni** ishga tushiring, keyin frontendni.

---

## 1. Kerakli dasturlar

Quyidagilar o'rnatilgan bo'lishi shart:

| Dastur | Versiya | Yuklab olish |
|---|---|---|
| **Node.js** | 20 yoki undan yuqori | <https://nodejs.org> (LTS) |
| **PostgreSQL** | 14+ (17 tavsiya) | <https://www.postgresql.org/download/> |
| **Git** | istalgan | <https://git-scm.com> |

Tekshirish (terminal / PowerShell):

```bash
node -v      # v20.x yoki yuqori
npm -v       # 10.x yoki yuqori
git --version
psql --version
```

> PostgreSQL o'rnatilganda `postgres` foydalanuvchisi uchun **parolni eslab qoling** — u `.env`ga kerak bo'ladi.

---

## 2. Reponi klonlash

```bash
git clone https://github.com/Hamroqulovv/bestway-backend.git
cd bestway-backend
```

---

## 3. Paketlarni o'rnatish

```bash
npm install
```

Bu Prisma klientini ham avtomatik generatsiya qiladi (`postinstall`). Agar qilmasa:
`npx prisma generate`.

---

## 4. Ma'lumotlar bazasini yaratish

Bazani bir marta yaratish kerak (nomi `.env`dagi `DATABASE_URL`ga mos bo'lsin — standart `education_center`).

**Windows (PowerShell):**
```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "CREATE DATABASE education_center"
```

**Linux / macOS:**
```bash
createdb education_center
# yoki
psql -U postgres -c "CREATE DATABASE education_center"
```

> Xohlasangiz PostgreSQL o'rniga Docker'dan foydalaning — [8-bo'limga](#8-muqobil-docker-bilan-hammasi-bir-buyruqda) qarang.

---

## 5. Sozlamalar fayli (`.env`)

Namunani nusxalang:

```bash
# Windows PowerShell
Copy-Item .env.example .env
# Linux / macOS
cp .env.example .env
```

`.env`ni oching va **kamida quyidagilarni** o'zgartiring:

1. **`DATABASE_URL`** — o'z PostgreSQL parolingizni qo'ying:
   ```
   DATABASE_URL="postgresql://postgres:SIZNING_PAROLINGIZ@localhost:5432/education_center?schema=public"
   ```

2. **`JWT_SECRET`** va **`STREAM_TOKEN_SECRET`** — tasodifiy uzun satrlar (xavfsizlik uchun **majburiy**):
   ```bash
   # Har biri uchun yangi kalit generatsiya qiling:
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Chiqqan qiymatlarni `.env`ga qo'ying.

3. (Ixtiyoriy) **`CENTER_NAME`** — sertifikat PDF'da chiqadigan markaz nomi.
4. (Ixtiyoriy) **`TELEGRAM_BOT_TOKEN`** — bo'sh qoldirsangiz bot o'chiq, faqat in-app bildirishnoma ishlaydi.

Qolgan barcha o'zgaruvchilar izohi — [`README.md` § 5](./README.md#5-muhit-ozgaruvchilari-env).

---

## 6. Jadvallarni yaratish + boshlang'ich ma'lumot

```bash
# 6.1 — Migratsiyalarni qo'llash (barcha jadvallarni yaratadi)
npx prisma migrate deploy

# 6.2 — Boshlang'ich ma'lumot. IKKALASIDAN BITTASINI tanlang:

#  (A) REAL boshlanish — faqat sozlamalar + super admin (.env dagi ma'lumot bilan)
npm run seed:init

#  (B) DEMO — test akkauntlari, guruh, testlar, maqolalar (faqat o'rganish/sinov uchun!)
npm run seed

#  (ixtiyoriy) To'liq IELTS mock imtihon namunasi (demo ustiga qo'shiladi)
npm run seed:mock
```

> ⚠️ **Prodakshanda faqat `seed:init`.** `seed` ochiq parolli demo akkauntlar yaratadi — real bazada ishlatmang.

---

## 7. Serverni ishga tushirish

```bash
npm run start:dev      # ishlab chiqish rejimi (o'zgarishlarni kuzatadi)
```

Server ko'tarilgach, quyidagilar ochiladi:

| Manzil | Nima |
|---|---|
| <http://localhost:3001/v1/health> | Salomatlik → `{ "success": true, "data": { "status": "ok" } }` |
| <http://localhost:3001/admin> | **Admin panel** (faqat `admin` / `super_admin` kiradi) |
| <http://localhost:3001/docs> | Swagger — interaktiv API hujjati |
| <http://localhost:3001/v1> | API asosiy manzili (base URL) |

**Tez tekshiruv** — health endpointni chaqiring:
```bash
curl http://localhost:3001/v1/health
```

Kirish uchun akkauntlar (`npm run seed` ishlatgan bo'lsangiz) — [`README.md` § 6](./README.md#6-akkauntlar-va-seed).
`seed:init` ishlatgan bo'lsangiz — `.env`dagi `SEED_SUPER_ADMIN_PHONE` / `_PASSWORD`.

---

## 8. Muqobil: Docker bilan (hammasi bir buyruqda)

PostgreSQL o'rnatishni istamasangiz:

```bash
# .env yaratib bo'lganingizdan keyin:
docker compose up -d
```

Bu PostgreSQL + API konteynerlarini ko'taradi va migratsiyalarni **avtomatik** qo'llaydi.
Keyin bazani seed qilish uchun:

```bash
docker compose exec api npm run seed:init
```

---

## 9. Keyingi qadam — frontendni ulash

Backend `http://localhost:3001`da ishlab tursin. Endi frontend reponi oching va uning
[`SETUP.md`](https://github.com/Hamroqulovv/bestway-frontend/blob/main/SETUP.md) yo'riqnomasiga
amal qiling. Frontend standart holda aynan shu manzilga ulanadi.

---

## 10. Tez-tez uchraydigan muammolar

| Belgi | Sabab / yechim |
|---|---|
| `Can't reach database server` | PostgreSQL ishlamayapti yoki `DATABASE_URL` noto'g'ri (parol/port/baza nomi). |
| `database "education_center" does not exist` | [4-qadam](#4-malumotlar-bazasini-yaratish)ni bajaring (bazani yarating). |
| `JWT_SECRET is not set` yoki auth ishlamayapti | `.env`da `JWT_SECRET` bo'sh — [5-qadam](#5-sozlamalar-fayli-env). |
| `Port 3001 is already in use` | Boshqa jarayon 3001'da. Uni to'xtating yoki `.env`da `PORT`ni o'zgartiring. |
| Migratsiya xatosi (`P3009` va h.k.) | Toza dev bazasida `npx prisma migrate reset` (⚠️ bazani tozalaydi), so'ng `migrate deploy`. |
| Prisma klient topilmadi | `npx prisma generate` ni qayta ishga tushiring. |

---

To'liq hujjat, modullar va biznes-qoidalar — [`README.md`](./README.md).
API endpointlar kontrakti — [`api-contract.md`](./api-contract.md).
