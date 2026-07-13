# Setup qo'llanma — Frontend (0 dan ishga tushirish)

Bu qo'llanma frontend web interfeysini ishga tushirishgacha bo'lgan har bir qadamni ko'rsatadi.
Batafsil ma'lumot (arxitektura, i18n, rollar, marshrutlar) — [`README.md`](./README.md).

> ⚠️ **Frontend backendsiz ishlamaydi.** U barcha ma'lumotni **[bestway-backend](https://github.com/Hamroqulovv/bestway-backend)**
> API'sidan oladi. **Avval backendni** ishga tushiring
> ([backend SETUP.md](https://github.com/Hamroqulovv/bestway-backend/blob/main/SETUP.md)), keyin bu yerga qayting.

---

## 1. Kerakli dasturlar

| Dastur | Versiya | Izoh |
|---|---|---|
| **Node.js** | **18.18+** (20 LTS tavsiya) | Next.js 16 talabi. <https://nodejs.org> |
| **Git** | istalgan | <https://git-scm.com> |
| **Ishlab turgan backend** | — | `http://localhost:3001` da (alohida repo) |

Tekshirish:

```bash
node -v      # v18.18 yoki yuqori
npm -v
```

---

## 2. Reponi klonlash

```bash
git clone https://github.com/Hamroqulovv/bestway-frontend.git
cd bestway-frontend
```

---

## 3. Paketlarni o'rnatish

```bash
npm install
```

---

## 4. Sozlamalar (`.env.local`) — ixtiyoriy

Standart holda frontend `http://localhost:3001/v1` backendiga ulanadi — agar backend shu manzilda
bo'lsa, **hech narsa sozlamasangiz ham bo'ladi**.

Backend boshqa manzilda bo'lsa, loyiha ildizida `.env.local` yarating:

```env
API_URL=http://localhost:3001/v1
```

| O'zgaruvchi | Standart | Vazifasi |
|---|---|---|
| `API_URL` | `http://localhost:3001/v1` | Backend manzili. **Faqat server tomonda** ishlatiladi — brauzerga ko'rinmaydi (barcha so'rov Next.js proxy orqali o'tadi). |
| `NEXT_PUBLIC_MEDIA_HOST` | _(yo'q)_ | `next/image` uchun qo'shimcha ruxsat etilgan host (masalan CDN). |

> `API_URL` `NEXT_PUBLIC_` prefiksisiz — shuning uchun u brauzer bundle'iga tushmaydi.
> Batafsil xavfsizlik modeli — [`README.md`](./README.md#authentication--security-model).

---

## 5. Ishga tushirish (dev)

Avval **backend ishlab turganiga** ishonch hosil qiling (`http://localhost:3001/v1/health` javob bersa).
So'ngra:

```bash
npm run dev
```

Brauzerda oching: **<http://localhost:3000>**

| Manzil | Nima |
|---|---|
| `/` | Ommaviy sayt (hero, kurslar, yangiliklar) — login shart emas |
| `/login`, `/register` | Kirish / ro'yxatdan o'tish (register faqat o'quvchi/ota-ona uchun) |
| `/dashboard` | Kirgandan keyin — rolga qarab turlicha ko'rinadi |

### Sinov akkauntlari (backend `npm run seed` bilan seed qilingan bo'lsa)

| Rol | Telefon | Parol |
|---|---|---|
| super_admin | `+998900000001` | `Super123!` |
| admin | `+998900000002` | `Admin123!` |
| teacher | `+998900000003` | `Teacher123!` |
| student | `+998900000010` | `Student123!` |
| parent | `+998900000020` | `Parent123!` |

> Bazada o'z ma'lumotingiz bo'lsa (seed emas), o'z login-parolingizni ishlating.

---

## 6. Prodakshan build

```bash
npm run build     # kompilyatsiya + type-check + statik sahifalarni tayyorlaydi
npm run start     # build'ni 3000-portda beradi
```

Prodakshanda `API_URL`ni haqiqiy backend manziliga qo'ying. Ilova Node.js ishlaydigan istalgan joyda
(Vercel, Node server, konteyner) ishlaydi — `/api/*` marshrutlar cookie va streaming ishlatgani uchun
**Node runtime kerak** (to'liq statik eksport qo'llab-quvvatlanmaydi).

---

## 7. Foydali buyruqlar

| Buyruq | Vazifasi |
|---|---|
| `npm run dev` | Dev server (Turbopack), 3000-port |
| `npm run build` | Prodakshan build |
| `npm run start` | Build'ni berish |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type-check (fayl chiqarmasdan) |

---

## 8. Tez-tez uchraydigan muammolar

| Belgi | Sabab / yechim |
|---|---|
| `502` / `BACKEND_UNREACHABLE` | Backend ishlamayapti. `API_URL`dagi manzilda backendni ishga tushiring. |
| Login `INVALID_CREDENTIALS` beradi | Bazada bunday user yo'q yoki parol xato. Seed parollari faqat toza seed qilingan bazada ishlaydi. |
| Bosh sahifada yangiliklar bo'sh | Backend yetib bo'lmayapti — bu ataylab xatoga olib kelmaydi, yangiliklar shunchaki ko'rinmaydi. |
| Sahifa `/dashboard`ga qaytaryapti | Rolingiz bu marshrutga ruxsat etilmagan (RBAC). |
| Sahifa `/login`ga qaytaryapti | Sessiya cookie yo'q — chiqib ketgansiz yoki sessiya tugagan. |
| `Port 3000 is in use` | Oldingi dev server ishlab turibdi. To'xtating yoki Next boshqa port tanlaydi. |
| `.next/types` bilan bog'liq type xatolar | Eskirgan generatsiya. `.next` papkasini o'chirib, `npm run build` qayta ishga tushiring. |

---

To'liq hujjat — [`README.md`](./README.md).
Backend API kontrakti — backend repodagi [`api-contract.md`](https://github.com/Hamroqulovv/bestway-backend/blob/main/api-contract.md).
