# API KONTRAKT — Backend va Frontend o'rtasidagi YAGONA MANBA

> **MUHIM:** Bu faylni backend-prompt.md va frontend-prompt.md bilan BIRGA, ikkala AI'ga ham bering (ikkalasiga ham xuddi shu nusxa). Ikkala tomon ham shu yerda yozilgan endpoint nomlari, maydon nomlari va formatlardan **bir milimetr ham chetga chiqmasligi kerak**. Agar biror narsani o'zgartirish kerak bo'lsa — avval shu faylni tahrirlang, keyin ikkala AI'ga yangilangan faylni qayta bering.
>
> Bu fayl bo'lmasa, backend va frontend har xil "til"da gaplashadi va ular bir-biriga ulanmaydi.

---

## 0. UMUMIY QOIDALAR

- Barcha API javoblari **JSON**, maydon nomlari **camelCase** (masalan `studentId`, yo'q — `student_id`).
- Barcha sana/vaqt **ISO 8601** formatida: `"2026-07-10T09:00:00Z"`.
- Base URL: `https://api.domain.uz/v1` (frontend `.env`da `NEXT_PUBLIC_API_URL` orqali oladi).
- Auth: har bir himoyalangan so'rovda header: `Authorization: Bearer <accessToken>`.
- Rollar aniq shu 5 ta qiymatdan biri (boshqa yozilishi mumkin emas):
  `"super_admin" | "admin" | "teacher" | "student" | "parent"`

---

## 1. STANDART JAVOB FORMATI

**Muvaffaqiyatli javob:**
```json
{
  "success": true,
  "data": { }
}
```

**Ro'yxat (pagination bilan):**
```json
{
  "success": true,
  "data": [ ],
  "meta": { "page": 1, "limit": 20, "total": 143 }
}
```

**Xatolik:**
```json
{
  "success": false,
  "error": {
    "code": "PAYMENT_NOT_FOUND",
    "message": "To'lov yozuvi topilmadi"
  }
}
```

HTTP status kodlari: `200` OK, `201` Created, `400` Validation error, `401` Unauthorized, `403` Forbidden (rol yetarli emas), `404` Not Found, `500` Server error.

---

## 2. AUTENTIFIKATSIYA

| Method | Path | Kim | Request body | Response |
|---|---|---|---|---|
| POST | `/auth/register` | Mehmon | `{ name, phone, password, role }` | `{ user, accessToken, refreshToken }` |
| POST | `/auth/login` | Mehmon | `{ phone, password }` | `{ user, accessToken, refreshToken }` |
| POST | `/auth/refresh` | Har kim | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| POST | `/auth/link-child` | Ota-ona | `{ linkCode }` | `{ child: StudentProfile }` |
| POST | `/auth/desktop/authorize` | O'quvchi | `{ deviceId, state, codeChallenge, redirect }` | `{ code, state, expiresAt }` |
| POST | `/auth/desktop/exchange` | Mehmon | `{ code, verifier, deviceId }` | `{ user, accessToken, refreshToken }` |

**Refresh token rotatsiyasi:** `/auth/refresh` har chaqiriqda yangi `refreshToken` qaytaradi va eskisi birda ishlatiladi (single-use). Allaqachon ishlatilgan (revoked) tokenni qayta yuborish reuse-hujum deb hisoblanadi — butun token oilasi bekor qilinadi va `SESSION_EXPIRED` xatosi (401) qaytadi.

**Desktop kirish (Tauri ilova):** `POST /auth/desktop/authorize` faqat `student` rolida, 5 daqiqalik bir martalik kod beradi (`redirect` faqat `bestway-exam://auth/callback` bo'lishi shart). `POST /auth/desktop/exchange` ochiq endpoint (10/daqiqa): PKCE-S256 (`BASE64URL(SHA256(verifier)) === codeChallenge`), `deviceId` mosligi, muddat va bir martaliklik tekshiriladi — noto'g'ri urinish kodni kuydiradi. Muvaffaqiyatda oddiy sessiya tokenlari qaytadi (rotatsiya/logout qoidalari bir xil).

`user` obyekti doim shu shaklda:
```json
{ "id": "uuid", "name": "string", "phone": "string", "role": "student", "createdAt": "iso-date" }
```

---

## 3. MARKAZIY ENUM'LAR (ikkala tomon ham xuddi shu qiymatlarni ishlatadi)

```
Role            = "super_admin" | "admin" | "teacher" | "student" | "parent"
AttendanceState = "present" | "absent" | "late"
PaymentState    = "paid" | "unpaid" | "partial"   // + client-only "empty" (yozuv yo'qligi) — A.6 ga qarang
PaymentMethod   = "manual"                      // hozircha faqat shu, kelajakda "payme" | "click" qo'shiladi
TestType        = "ielts" | "multilevel"
TestSection     = "listening" | "reading" | "writing" | "speaking"
AttemptStatus   = "in_progress" | "grading" | "completed"
NotificationType = "points" | "payment_reminder" | "test_result" | "attendance"
```

---

## 4. ENDPOINT RO'YXATI (modul bo'yicha)

### Users / Groups
| Method | Path | Rol | Izoh |
|---|---|---|---|
| GET | `/users?role=&groupId=` | admin, super_admin | Ro'yxat + filter |
| GET | `/users/:id` | tegishli rollar | Bitta foydalanuvchi |
| PATCH | `/users/:id` | admin, super_admin | Profil tahrirlash |
| POST | `/groups` | admin, super_admin | `{ name, teacherId }` |
| POST | `/groups/:id/students` | admin | `{ studentId }` — guruhga qo'shish |

### Attendance
| Method | Path | Rol | Request | Response |
|---|---|---|---|---|
| GET | `/attendance?groupId=&month=` | teacher, admin, parent, student | — | `[{ studentId, date, state }]` |
| PUT | `/attendance/bulk` | teacher | `{ groupId, date, records: [{studentId, state}] }` | `{ updated: number }` |

### Payments
| Method | Path | Rol | Request | Response |
|---|---|---|---|---|
| GET | `/payments?studentId=&year=` | admin, parent, student, teacher | — | `[{ studentId, month, year, state, amount, method:"manual", note }]` |
| PUT | `/payments/bulk` | admin, teacher | `{ year, records: [{studentId, month, state, amount, note}] }` | `{ updated: number }` |

### Points
| Method | Path | Rol | Request | Response |
|---|---|---|---|---|
| GET | `/points/:studentId` | student, parent, teacher, admin | — | `{ current: number, history: [{ change, reason, byUserId, date }] }` |
| POST | `/points/:studentId/adjust` | teacher (limitli), admin | `{ change, reason }` | `{ current: number }` |
| GET | `/points/leaderboard?groupId=` | har kim | — | `[{ studentId, name, points, rank }]` |

### Tests
| Method | Path | Rol | Request | Response |
|---|---|---|---|---|
| GET | `/tests?type=` | student, teacher, admin | — | Testlar ro'yxati |
| POST | `/tests/:id/start` | student | — | `{ attemptId, questions: [...] }` (random tartibda) |
| POST | `/tests/attempts/:attemptId/answer` | student | `{ questionId, answer }` | `{ saved: true }` |
| POST | `/tests/attempts/:attemptId/flag-cheat` | student (frontend avtomatik) | `{ event: "tab_switch" }` | `{ saved: true }` |
| POST | `/tests/attempts/:attemptId/submit` | student | — | `{ status: "grading" or "completed", autoScore }` |
| POST | `/tests/attempts/:attemptId/grade` | teacher | `{ questionId, score, comment }` (Writing/Speaking uchun) | `{ saved: true }` |
| GET | `/tests/attempts/:attemptId/certificate` | student | — | PDF fayl (binary) |

### Videos
| Method | Path | Rol | Request | Response |
|---|---|---|---|---|
| GET | `/videos` | har kim | — | `[{ id, title, price, isFreeForApproved, thumbnailUrl }]` |
| GET | `/videos/:id/stream-url` | ruxsat bor bo'lsa | — | `{ url, expiresAt }` — token-based |
| POST | `/videos/:id/purchase` | student | — | Admin tomonidan qo'lda tasdiqlanishi kutiladi → `{ status: "pending_confirmation" }` |
| POST | `/videos/:id/confirm-purchase` | admin | `{ userId }` | `{ status: "purchased" }` |

### Articles / Notifications
| Method | Path | Rol | Request | Response |
|---|---|---|---|---|
| GET | `/articles?category=` | har kim | — | Ro'yxat |
| POST | `/articles` | admin | `{ title, body, category, tags }` | Yaratilgan maqola |
| GET | `/notifications` | login qilingan | — | `[{ id, type, text, read, date }]` |
| PATCH | `/notifications/:id/read` | login qilingan | — | `{ read: true }` |

---

## 5. QOIDALAR — IKKALA AI HAM RIOYA QILISHI SHART

1. Yuqoridagi path va maydon nomlarini **aynan shu ko'rinishda** ishlatish kerak — sinonim yoki "yaxshiroq nom" o'ylab topmaslik.
2. Yangi endpoint kerak bo'lib qolsa, avval shu faylga qo'shib, keyin ikkala tomonga bering — birinchi ulardan biri "o'zidan" endpoint qo'shmasin.
3. Frontend backend tayyor bo'lmaguncha shu kontraktdagi shakllar asosida **mock data** bilan ishlaydi (masalan MSW yordamida) — shunda ikkalasi parallel ishlay oladi va oxirida faqat `NEXT_PUBLIC_API_URL`ni almashtirish kifoya qiladi.
4. Backend shu formatlardan chetga chiqsa (masalan xatolikni boshqacha o'raydigan bo'lsa), bu **kontraktni buzish** hisoblanadi — tuzatilishi shart.

---

## 6. AMALIY TAVSIYA — QANDAY QILIB YURITISH KERAK

1. **Avval shu kontrakt faylini yakunlang** (agar loyiha davomida yangi modul chiqsa, shu yerga qo'shing).
2. Backend AI'siga: `backend-prompt.md` + `api-contract.md` — ikkalasini birga bering.
3. Frontend AI'siga: `frontend-prompt.md` + `api-contract.md` — ikkalasini birga bering.
4. Backend tugagach, **Swagger/OpenAPI** hujjatini generatsiya qiling (NestJS'da bu deyarli avtomatik) va uni ham frontend AI'siga tashlang — bu qo'shimcha tekshiruv qatlami bo'ladi.
5. Oxirida albatta **integratsiya testi** o'tkazing: frontendni haqiqiy backendga ulab, har bir sahifani qo'lda tekshiring — kichik nomuvofiqliklar (masalan bitta maydon nomi) chiqishi mumkin, ular tez tuzatiladi.

---

# ILOVA A — BACKEND QO'SHGAN ENDPOINTLAR (v1.1)

> Bu bo'lim backend yozilgandan keyin, 5-bo'limning 2-qoidasiga muvofiq qo'shildi.
> Yuqoridagi 4-bo'lim (asosiy kontrakt) **o'zgarmagan** — hammasi aynan o'sha holicha ishlaydi.
> Bu yerdagilar — panel ishlashi uchun zarur bo'lgan **qo'shimcha** endpointlar.
> Jonli hujjat: `http://localhost:3001/docs` (Swagger).

## A.1 Umumiy eslatmalar

- Base URL: **`/v1`** (masalan `http://localhost:3001/v1/auth/login`).
- Ro'yxat qaytaradigan endpointlar `?page=1&limit=20` qabul qiladi va `meta: { page, limit, total }` bilan javob beradi. Quyida "Paginated" deb belgilangan.
- `studentId` **har doim** `User.id` ga teng (alohida student id yo'q) — shuning uchun `/users/:id` va `/points/:studentId` da bir xil qiymat ishlatiladi.
- Sanalar ISO 8601. Faqat `attendance.date` — `"YYYY-MM-DD"` (kun aniqligida).

## A.2 Auth (qo'shimcha)

| Method | Path | Rol | Request | Response |
|---|---|---|---|---|
| GET | `/auth/me` | login qilingan | — | `{ user: {id,name,phone,role,createdAt}, profile, unreadNotifications }` |
| POST | `/auth/logout` | login qilingan | `{ refreshToken }` | `{ loggedOut: true }` |

- `/auth/me` dagi `profile` rolga qarab o'zgaradi:
  - `student` → `{ isApproved, groupId, groupName, currentPoints, linkCode }`
  - `parent` → `{ children: [{ studentId, name, groupId, groupName, isApproved, currentPoints }] }`
  - `teacher` → `{ groups: [{ id, name, studentsCount }] }`
  - `admin` / `super_admin` → `null`
- **`/auth/register` cheklovi:** `role` faqat `"student"` yoki `"parent"` bo'lishi mumkin. `admin`/`teacher`/`super_admin` ro'yxatdan o'tish orqali yaratilmaydi (aks holda `400 VALIDATION_ERROR`) — ularni admin `POST /users` orqali qo'shadi.
- `linkCode` — o'quvchining 8 belgili kodi (`POST /auth/link-child` uchun). Uni o'quvchining o'zi (`/auth/me`) va admin (`GET /users/:id`) ko'radi.

## A.3 Users (qo'shimcha)

| Method | Path | Rol | Request | Response |
|---|---|---|---|---|
| POST | `/users` | admin, super_admin | `{ name, phone, password, role, groupId? }` | Yaratilgan foydalanuvchi |
| DELETE | `/users/:id` | super_admin | — | `{ deactivated: true }` — yumshoq o'chirish |

- `GET /users` qo'shimcha filtrlar: `?role=&groupId=&search=&page=&limit=` (Paginated). `search` — ism yoki telefon bo'yicha.
- Foydalanuvchi obyekti shakli:
  ```json
  { "id": "...", "name": "...", "phone": "+998...", "role": "student", "isActive": true,
    "createdAt": "...",
    "student": { "isApproved": false, "groupId": "...", "groupName": "...", "currentPoints": 100, "linkCode": "AB12CD34" } }
  ```
  `student` maydoni faqat `role === "student"` bo'lganda to'ladi, aks holda `null`. `linkCode` faqat o'zi va adminlarga ko'rinadi.
- `PATCH /users/:id` qabul qiladi: `{ name?, phone?, password?, role?, isActive?, isApproved?, groupId?, telegramChatId? }`.
  - `role` ni faqat **super_admin** o'zgartira oladi.
  - `isApproved: true` → "tasdiqlangan o'quvchi": barcha videolar unga bepul ochiladi.
- `POST /users` bilan `role: "admin"` ni faqat super_admin qo'sha oladi; `role: "super_admin"` umuman yaratilmaydi.

## A.4 Groups (qo'shimcha)

| Method | Path | Rol | Request | Response |
|---|---|---|---|---|
| GET | `/groups` | login qilingan | — | `[{ id, name, teacherId, teacherName, schedule, studentsCount }]` |
| GET | `/groups/:id` | tegishli rollar | — | Guruh + `students: [{ studentId, name, currentPoints, isApproved }]` |
| PATCH | `/groups/:id` | admin, super_admin | `{ name?, teacherId?, schedule? }` | Yangilangan guruh |
| DELETE | `/groups/:id/students/:studentId` | admin, super_admin | — | `{ removed: true }` |

- `schedule` shakli: `[{ "day": "mon", "startTime": "14:00", "endTime": "16:00" }]`. `day` ∈ `mon|tue|wed|thu|fri|sat|sun`.
- `GET /groups` rolga qarab filtrlaydi: o'qituvchi — faqat o'z guruhlari, o'quvchi — o'z guruhi, ota-ona — farzandlari guruhlari.

## A.5 Attendance (qo'shimcha)

| Method | Path | Rol | Request | Response |
|---|---|---|---|---|
| GET | `/attendance/stats?groupId=&month=` | teacher, admin | — | `[{ studentId, name, present, absent, late }]` |

- `GET /attendance` query: `?groupId=&month=YYYY-MM&studentId=`. `month` berilmasa — joriy oy.
  - **teacher/admin** uchun `groupId` majburiy (aks holda `400 GROUP_ID_REQUIRED`).
  - student/parent uchun `groupId` shart emas — o'zining/farzandining yozuvlari qaytadi.
- `PUT /attendance/bulk` `{ updated: number }` qaytaradi. Guruhga tegishli bo'lmagan o'quvchi yuborilsa — `400 STUDENT_NOT_IN_GROUP`.
- O'quvchi **birinchi marta** `absent` deb belgilanganda ota-onasiga avtomatik bildirishnoma ketadi (`type: "attendance"`).

## A.6 Payments (qo'shimcha)

| Method | Path | Rol | Request | Response |
|---|---|---|---|---|
| GET | `/payments/debtors?month=&year=` | admin, super_admin, teacher | — | `[{ studentId, name, phone, groupName, state, amount, note }]` |
| POST | `/payments/remind` | admin, super_admin, teacher | `{ month?, year?, studentIds?: string[] }` | `{ notified: number }` |

- `month`/`year` berilmasa — **joriy oy**. `studentIds` berilmasa — o'sha oyning barcha qarzdorlariga eslatma ketadi. To'lagan (`paid`) o'quvchiga eslatma yuborilmaydi.
- `GET /payments` query: `?studentId=&year=&month=&state=`; javobda `studentName` ham bor. Faqat mavjud yozuvlar qaytadi — yozuv yo'qligi = **Empty** (holat hali qayd etilmagan).
- `PUT /payments/bulk` `{ updated: number }` qaytaradi. `state: "empty"` — client-only holat: shu katakdagi Payment yozuvini **o'chiradi** (DB enum'da `empty` yo'q, ustun nullable emas). Tsikl: `empty → paid → partial → unpaid → empty`.
- `GET /payments/debtors` dagi `state` — `"paid" | "partial" | "unpaid" | "empty"`: yozuv yo'q bo'lsa `"empty"` qaytadi (`"unpaid"` bilan adashtirmaslik — `unpaid` admin aniq belgilagan qarzdorlik).
- **O'qituvchi scoping:** `teacher` roli barcha 4 endpointga kira oladi, lekin faqat o'ziga biriktirilgan guruhlar o'quvchilari bo'yicha: `GET` begona `studentId` ga `403 FORBIDDEN`, `PUT /bulk` dagi begona yozuv butun so'rovni `403` qiladi, `debtors`/`remind` avtomatik o'z guruhlariga torayadi.
- **Onlayn to'lov yo'q**: `method` doim `"manual"`. To'lov holatini faqat xodim qo'lda belgilaydi (admin — barcha guruhda, o'qituvchi — o'z guruhlarida).

## A.7 Tests (qo'shimcha)

| Method | Path | Rol | Request | Response |
|---|---|---|---|---|
| POST | `/tests` | admin | `{ type, title, level?, isDemo?, durationMinutes?, sectionQuestionCounts? }` | Test |
| GET | `/tests/:id` | login qilingan | — | Test + savollar (xodimlar `correctAnswer` ni ham ko'radi) |
| PATCH | `/tests/:id` | admin | `{ title?, level?, isDemo?, isActive?, durationMinutes?, sectionQuestionCounts? }` | Test |
| POST | `/tests/:id/questions` | admin | `{ section, type, prompt, options?, correctAnswer?, maxScore? }` | Savol |
| PATCH | `/tests/questions/:questionId` | admin | Yuqoridagi maydonlar (barchasi ixtiyoriy) | Savol |
| DELETE | `/tests/questions/:questionId` | admin | — | `{ deleted: true }` |
| GET | `/tests/attempts?status=&studentId=&testId=` | teacher, admin | — | Paginated urinishlar (baholash navbati) |
| GET | `/tests/attempts/mine` | student | — | Paginated o'z urinishlari |
| GET | `/tests/attempts/:attemptId` | tegishli rollar | — | Urinish + `questions` (javoblar bilan) |

- **Yangi enum — `QuestionType`:** `"multiple_choice" | "short_answer" | "essay" | "speaking"`.
- `sectionQuestionCounts` — har bir bo'limdan tasodifiy nechta savol tanlanishini belgilaydi: `{"listening":10,"reading":10}`. Har bir urinishda savollar **tasodifiy tanlanadi va tasodifiy tartibda** beriladi (nusxa ko'chirishga qarshi).
- `POST /tests/:id/start` javobi kengaytirilgan:
  ```json
  { "attemptId": "...", "resumed": false, "durationMinutes": 60, "startedAt": "...",
    "questions": [{ "id", "section", "type", "prompt", "options", "maxScore" }] }
  ```
  Savollarda **`correctAnswer` hech qachon yuborilmaydi**. Agar o'quvchida tugallanmagan urinish bo'lsa — yangi urinish ochilmaydi, **o'sha urinish davom ettiriladi**: javobda `resumed: true` va `savedAnswers: { questionId: "javob" }` qo'shiladi (sahifa yangilansa javoblar yo'qolmaydi).
- `POST /tests/attempts/:attemptId/grade` da maydon nomi — **`comment`** (`feedback` emas). `score > maxScore` bo'lsa `400 SCORE_OUT_OF_RANGE`.
- Barcha Writing/Speaking savollari baholangach urinish avtomatik `completed` bo'ladi va `totalScore = autoScore + manualScore` hisoblanadi.
- `GET /tests/attempts/:attemptId` javobida xodimlar uchun qo'shimcha `correctAnswer` va `cheatEvents: [{ event, date }]` bo'ladi; o'quvchi ularni ko'rmaydi.
- `antiCheatCount` — `flag-cheat` chaqiruvlari soni; urinish obyektida qaytadi.

## A.7b Real Mock Exam (`/mock`) — YANGI, mustaqil modul

Real IELTS/Multilevel mock imtihon tizimi. Mavjud `/tests` moduliga **tegmaydi** — o'ziga xos `Mock*` jadvallari va `/mock/...` marshrutlaridan foydalanadi. Tuzilma: **Exam → Section (skill) → QuestionGroup (matn/audio/ko'rsatma) → Question**.

**Enumlar:**
- `MockExamType`: `"ielts_academic" | "ielts_general" | "multilevel"`
- `MockSkill`: `"listening" | "reading" | "writing" | "speaking"`
- `MockQuestionType`: `"multiple_choice" | "multi_select" | "true_false_notgiven" | "yes_no_notgiven" | "matching" | "matching_headings" | "sentence_completion" | "note_completion" | "summary_completion" | "table_completion" | "short_answer" | "map_labelling" | "essay_task1" | "essay_task2" | "speaking_task"`
- `MockAttemptStatus`: `"in_progress" | "grading" | "completed"`

**Authoring (admin/super_admin):**

| Method | Path | Rol | Request | Response |
|---|---|---|---|---|
| POST | `/mock/exams` | admin | `{ type, title, description?, level?, isDemo? }` | Exam |
| GET | `/mock/exams?type=` | ochiq (OptionalAuth) | — | Ro'yxat (mehmon/ota-ona: demo; o'quvchi: published+demo; xodim: hammasi) |
| GET | `/mock/exams/:id` | ochiq (OptionalAuth) | — | Exam + sections→groups→questions (xodim `correctAnswers` ni ham ko'radi) |
| PATCH | `/mock/exams/:id` | admin | `{ title?, description?, level?, isPublished?, isDemo? }` | Exam |
| DELETE | `/mock/exams/:id` | super_admin | — | `{ deleted: true }` |
| POST | `/mock/exams/:id/sections` | admin | `{ skill, title?, sortOrder?, durationMinutes?, instructions? }` | Section (skill bo'yicha bitta) |
| PATCH/DELETE | `/mock/sections/:sectionId` | admin | — | Section / `{ deleted }` |
| POST | `/mock/sections/:sectionId/groups` | admin | `{ sortOrder?, title?, instructions?, passageText? }` | Group |
| PATCH/DELETE | `/mock/groups/:groupId` | admin | — | Group / `{ deleted }` |
| POST | `/mock/groups/:groupId/media` | admin | `multipart`: `audio?`, `image?` | `{ hasAudio, audioUrl, imageUrl }` |
| GET | `/mock/groups/:groupId/audio` | OptionalAuth (demo: mehmon) | — | Audio oqimi (`206`, Range) |
| GET | `/mock/groups/:groupId/image` | OptionalAuth | — | Rasm (binary) |
| POST | `/mock/groups/:groupId/questions` | admin | `{ questions: [{ number, sortOrder?, type, prompt, options?, correctAnswers?, points?, wordLimit? }] }` | `{ added, questions }` |
| PATCH/DELETE | `/mock/questions/:questionId` | admin | Yuqoridagi maydonlar | Question / `{ deleted }` |

**O'quvchi oqimi:**

| Method | Path | Rol | Request | Response |
|---|---|---|---|---|
| POST | `/mock/exams/:id/start` | student | — | `{ attemptId, resumed, startedAt, serverTime, durationMinutes, exam, savedAnswers }` |
| POST | `/mock/attempts/:attemptId/answer` | student | `{ questionId, response }` | `{ saved: true }` |
| POST | `/mock/attempts/:attemptId/answers` | student | `{ answers: [{ questionId, response }] }` | `{ saved: N }` |
| POST | `/mock/attempts/:attemptId/flag-cheat` | student | `{ event }` | `{ saved: true }` |
| POST | `/mock/attempts/:attemptId/submit` | student | — | `{ status, rawScores, sectionBands, overallBand, cefrLevel }` |
| GET | `/mock/attempts/mine?status=` | student | — | Paginated o'z urinishlari |

**Baholash / natija:**

| Method | Path | Rol | Request | Response |
|---|---|---|---|---|
| GET | `/mock/attempts?status=&studentId=&examId=` | teacher, admin | — | Paginated (teacher: faqat o'z guruhi) |
| GET | `/mock/attempts/:attemptId` | tegishli rollar | — | Urinish + `sections` (javoblar, ball, band); xodim: `correctAnswers`, `cheatEvents` |
| POST | `/mock/attempts/:attemptId/grade` | teacher, admin | `{ questionId, score?, feedback?, rubricScores? }` | `{ saved, status }` |
| GET | `/mock/attempts/:attemptId/certificate` | tegishli rollar | — | PDF (band/CEFR bilan) |

**Baholash qoidalari:**
- **Listening/Reading** — avtomatik (`correctAnswers` bo'yicha). Moslik: registr/probel/tinish belgisiga sezgir emas, boshidagi `a/an/the` ixtiyoriy, raqam↔so'z ekvivalent (`"3"=="three"`). `multi_select` — tanlovlar to'plami aynan mos kelishi kerak.
- **Writing/Speaking** — qo'lda (`grade`). IELTS uchun `score` = band (0–9, 0.5 qadam), savol `points`=9. `rubricScores` — writing `{ta,cc,lr,gra}` / speaking `{fluency,lexical,grammar,pronunciation}` (har biri 0–9, 0.5 qadam). `score` berilmasa va 4 ta mezon to'liq bo'lsa — score rubric o'rtachasidan avtomatik hisoblanadi. Barcha qo'lda savollar baholangach urinish `completed` bo'ladi.
- **IELTS band**: har bo'lim xom bali 40 balllik ekvivalentga keltirilib jadval bo'yicha bandga aylanadi. Jadvallar standart (Listening: 39–40=9 … 11–12=4; Reading Academic: 39–40=9 … 10–12=4; Reading GT: 40=9 … 15–18=4; pastdagilar — quyi bandlar) va super_admin `PUT /settings/ielts-bands` orqali har bir test formasi uchun tahrirlashi mumkin (equating). Writing bo'lim bandi `(task1 + 2·task2)/3`. `overallBand` = 4 bo'lim o'rtachasi, rasmiy yaxlitlash bilan (.25 → keyingi .5 ga, .75 → keyingi butunga; masalan 6.625 → 6.5, 6.75 → 7.0). Writing/Speaking baholanmaguncha `overallBand: null` ("Pending") — qisman xom ball final sifatida ko'rsatilmaydi. `cefrLevel` banddan chiqariladi.
- **Multilevel**: band hisoblanmaydi; `cefrLevel` umumiy foizdan (`A1..C1`) aniqlanadi, `sectionBands`/`overallBand` = `null`.
- `submit` da qo'lda savol qolgan bo'lsa `status: "grading"` va `overallBand: null` (avto bo'lim bandlari allaqachon `sectionBands` da). Sanitizatsiya: `start` va o'quvchi `GET /mock/exams/:id` da `correctAnswers` **yuborilmaydi**.
- `durationMinutes` — bo'limlar vaqtlari yig'indisi (frontend har bo'lim uchun alohida taymer qo'yishi mumkin).

### A.7b — v2 qo'shimchalar (pullik kirish, rejim, paste, speaking audio)

**Authoring endi `teacher` uchun ham ochiq** (`teacher | admin | super_admin`); faqat `DELETE /mock/exams/:id` — `super_admin`. `POST /mock/exams` va `PATCH /mock/exams/:id` ga `price?` (so'mda, 0=bepul) va `isFreeForApproved?` qo'shildi.

**Savolni paste qilib parse qilish (admin/teacher):**

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/mock/parse-questions` | `{ text }` | `{ instructions, count, questions: [{ number, prompt, options?, type }] }` — preview, bazaga yozmaydi |
| POST | `/mock/groups/:groupId/questions/import` | `{ text, answers?: { "1":"B", "2":"flowers/flower" }, points? }` | `{ added, questions }` |

- Parser: `1.`/`1)`/`Q1` — savol; `A)`/`B.` — variant; `____`/`...` — completion; boshida "TRUE/FALSE/NOT GIVEN" ko'rsatmasi bo'lsa TFNG. Tur avtomatik topiladi.
- `import`: javob kaliti **savol raqami bo'yicha**. MCQ da harf (`B`) → variant matni ham kalitga qo'shiladi (o'quvchi harf yoki matn yuborsa ham to'g'ri). TFNG qisqartmalari (`T/F/NG`) yoyiladi. Auto bo'limda (listening/reading) javobsiz qolgan savollar bo'lsa `400 MISSING_ANSWERS` (raqamlari bilan).

**Pullik kirish (oddiy userlar sotib olib ishlatadi — qo'lda tasdiq):**

| Method | Path | Rol | Request | Response |
|---|---|---|---|---|
| POST | `/mock/exams/:id/purchase` | student | — | `{ status: "pending_confirmation", amount }` |
| GET | `/mock/purchases?status=` | admin | — | Paginated xaridlar (tasdiqlash paneli) |
| POST | `/mock/exams/:id/confirm-purchase` | admin | `{ userId }` | `{ confirmed: true }` |

- `GET /mock/exams` va `GET /mock/exams/:id` javobida har imtihon uchun `price` va `access: "granted" | "pending" | "locked"` bo'ladi.
- Kirish: staff/demo/`price=0` → ochiq; tasdiqlangan o'quvchi + `isFreeForApproved` → bepul; aks holda xarid kerak. Kirish yo'q holatda `start` → `402 MOCK_PAYMENT_REQUIRED` (yoki `MOCK_PURCHASE_PENDING`).

**Rejim (vaqtli / vaqtsiz):**
- `POST /mock/exams/:id/start` **body**: `{ mode?: "practice" | "timed" }` (standart `practice`).
- Javobda: `mode`, `startedAt`, `deadlineAt` (timed uchun = startedAt + bo'limlar davomiyligi), `serverTime` (taymer sinxronizatsiyasi uchun), `annotations`.
- `timed` rejimda muddat o'tgach javob saqlash `400 MOCK_TIME_UP` (frontend ekranni full qilib taymerni yuritadi, tugaganda submit qiladi).

**Speaking audio (o'quvchi ovozini yuklaydi):**

| Method | Path | Rol | Request | Response |
|---|---|---|---|---|
| POST | `/mock/attempts/:attemptId/speaking/:questionId` | student | `multipart`: `audio` | `{ saved, audioUrl }` |
| GET | `/mock/attempts/:attemptId/answers/:questionId/audio` | egasi/xodim | — | Audio oqimi (Range) |

- O'qituvchi `GET /mock/attempts/:attemptId` da `audioUrl` orqali tinglab, `grade` bilan band qo'yadi.

**Highlight / annotatsiya:**
- `PUT /mock/attempts/:attemptId/annotations` `{ annotations: [...] }` → saqlanadi; `start` va `GET attempt` javobida qaytadi (sahifa yangilansa yo'qolmaydi). *Belgilash UI (matnni tanlab o'ng-tugma) — frontend tomonida.*

**Boshqa:** urinish tugagach (`completed`) o'quvchi o'z **to'g'ri javoblarini** ko'radi (`correctAnswers` javobda bo'ladi). Bo'limlar ixtiyoriy — imtihon faqat Reading, yoki Writing, yoki istalgan kombinatsiya bo'lishi mumkin; band mavjud bo'limlardan hisoblanadi.

## A.8 Videos (qo'shimcha)

| Method | Path | Rol | Request | Response |
|---|---|---|---|---|
| POST | `/videos` | admin | `multipart/form-data`: `file` (video), `thumbnail?` (rasm), `title`, `description?`, `price`, `isFreeForApproved?` | Video |
| GET | `/videos/stream?token=` | ochiq (token bilan) | — | Video oqimi (`206 Partial Content`, Range) |
| GET | `/videos/purchases?status=` | admin | — | Paginated xaridlar (tasdiqlash paneli) |
| GET | `/videos/:id/thumbnail` | ochiq | — | Rasm (binary) |
| PATCH | `/videos/:id` | admin | `{ title?, description?, price?, isFreeForApproved? }` | Video |
| DELETE | `/videos/:id` | super_admin | — | `{ deleted: true }` |

- **Yangi enum — `PurchaseStatus`:** `"pending_confirmation" | "purchased"`.
- `GET /videos` javobidagi har bir element (login qilingan bo'lsa `access` maydoni ham bo'ladi):
  ```json
  { "id", "title", "description", "price", "isFreeForApproved", "thumbnailUrl",
    "createdAt", "access": "granted" }
  ```
  `access` ∈ `"granted" | "pending_confirmation" | "locked"`. Fayl yo'li (`fileKey`) hech qachon qaytmaydi.
- `GET /videos/purchases` elementi: `{ id, userId, userName, userPhone, videoId, videoTitle, price, status, method, createdAt }`.
- `GET /videos/:id/stream-url` → `{ url, expiresAt }`. `url` — vaqtinchalik imzolangan havola (`/v1/videos/stream?token=...`), standart amal qilish muddati 1 soat. Ruxsat bo'lmasa `403 VIDEO_ACCESS_DENIED`.
- Xarid oqimi: o'quvchi `POST /videos/:id/purchase` → `pending_confirmation` → admin pulni naqd oladi → `POST /videos/:id/confirm-purchase` `{ userId }` → `purchased`.

## A.9 Articles / Notifications (qo'shimcha)

| Method | Path | Rol | Request | Response |
|---|---|---|---|---|
| GET | `/articles/:id` | ochiq | — | Maqola |
| PATCH | `/articles/:id` | admin | `{ title?, body?, category?, tags? }` | Maqola |
| DELETE | `/articles/:id` | admin | — | `{ deleted: true }` |
| PATCH | `/notifications/read-all` | login qilingan | — | `{ updated: number }` |

- `GET /articles` query: `?category=&tag=&page=&limit=` (Paginated). Maqola: `{ id, title, body, category, tags, authorName, createdAt }`.
- `GET /notifications` query: `?unreadOnly=true&type=&page=&limit=` (Paginated).

## A.10 Settings / Audit / Health (yangi modullar)

| Method | Path | Rol | Request | Response |
|---|---|---|---|---|
| GET | `/settings` | teacher, admin, super_admin | — | `{ teacherPointLimit: 20, initialPoints: 100 }` |
| PATCH | `/settings` | **super_admin** | `{ teacherPointLimit?, initialPoints? }` | Yangilangan sozlamalar |
| GET | `/settings/ielts-bands` | teacher, admin, super_admin | — | `{ listening, readingAcademic, readingGeneral, customized }` — amaldagi xom→band jadvallari `[[minRaw, band], ...]` |
| PUT | `/settings/ielts-bands` | **super_admin** | `{ listening?, readingAcademic?, readingGeneral? }` | Yangilangan jadvallar (berilmagani o'zgarmaydi) |
| DELETE | `/settings/ielts-bands` | **super_admin** | — | Standart jadvallarga qaytarildi |
| GET | `/audit-logs?entity=&userId=&action=` | **super_admin** | — | Paginated audit jurnali |
| GET | `/health` | ochiq | — | `{ status: "ok", time }` |

- `teacherPointLimit` — o'qituvchi bir amalda bera oladigan maksimal ball (±). Super admin o'zgartirsa **darhol** kuchga kiradi.
- `initialPoints` — yangi o'quvchiga beriladigan boshlang'ich ball (standart 100).
- Audit yozuvi: `{ id, userId, action, entity, entityId, oldValue, newValue, createdAt }`.

## A.11 Telegram bog'lash (yangi modul)

Telegram xabarlari ishlashi uchun foydalanuvchining Telegram akkaunti sayt akkaunti bilan
bog'langan bo'lishi kerak. Bog'lanish **bir martalik token** orqali amalga oshadi.

| Method | Path | Rol | Request | Response |
|---|---|---|---|---|
| GET | `/telegram/status` | login qilingan | — | `{ linked: boolean, botUsername: string \| null }` |
| POST | `/telegram/link-token` | login qilingan | — | `{ url, token, expiresAt }` |
| DELETE | `/telegram/link` | login qilingan | — | `{ unlinked: boolean }` |
| POST | `/telegram/webhook` | — | Telegram serveri chaqiradi | *(frontend ishlatmaydi)* |

**Frontend nima qiladi:**
1. Profil sahifasida `GET /telegram/status` (yoki `/auth/me` dagi `telegramLinked`) ni tekshiradi.
2. Bog'lanmagan bo'lsa **"Telegramni ulash"** tugmasini ko'rsatadi → `POST /telegram/link-token`
   → qaytgan `url` ni yangi oynada ochadi (`window.open(url)`) yoki QR kod qilib chizadi
   (telefon bilan skanerlash uchun). `url` ko'rinishi: `https://t.me/<bot>?start=<token>`.
3. Foydalanuvchi Telegramda "Start" bosgach bog'lanish tugaydi. Frontend `GET /telegram/status`
   ni bir necha soniyada qayta so'rab (polling) yoki "Tekshirish" tugmasi bilan holatni yangilaydi.
4. Bog'langan bo'lsa **"Telegramni uzish"** tugmasi → `DELETE /telegram/link`.

**Muhim:**
- `token` 1 marta ishlatiladi va 10 daqiqada eskiradi (`TELEGRAM_LINK_TTL_MINUTES`).
- Bir Telegram chat — bitta akkaunt. Boshqa akkauntga ulansa, eskisidan avtomatik uziladi.
- Zaxira yo'l (saytga kirmasdan): foydalanuvchi botga `/start` yozadi va **o'z telefon raqamini**
  ulashadi — backend raqamni `User.phone` bilan solishtirib bog'laydi.
- Bot buyruqlari: `/start`, `/status`, `/unlink`, `/help`.
- `GET /auth/me` javobiga `telegramLinked: boolean` maydoni qo'shildi.
- Telegram sozlanmagan bo'lsa `POST /telegram/link-token` → `400 TELEGRAM_DISABLED`.
  In-app bildirishnomalar baribir ishlayveradi.

## A.12 Statistika, e'lon va eksport (admin panel uchun)

| Method | Path | Rol | Request | Response |
|---|---|---|---|---|
| GET | `/stats/dashboard` | admin, super_admin | — | Umumiy ko'rsatkichlar (pastda) |
| GET | `/stats/income?months=6` | admin, super_admin | — | `[{ month, year, income, paidCount }]` |
| GET | `/stats/export/students?groupId=` | admin, super_admin | — | CSV fayl |
| GET | `/stats/export/payments?year=&month=` | admin, super_admin | — | CSV fayl |
| GET | `/stats/export/attendance?groupId=&month=` | admin, super_admin | — | CSV fayl |
| POST | `/notifications/broadcast` | admin, super_admin | `{ audience, role?, groupId?, includeParents?, text }` | `{ notified: number }` |

`GET /stats/dashboard` javobi:
```json
{ "students": 42, "approvedStudents": 12, "teachers": 4, "parents": 30, "groups": 6, "tests": 3, "videos": 8,
  "today": { "date": "2026-07-10", "marked": 38, "present": 33, "absent": 3, "late": 2, "attendanceRate": 92 },
  "month": { "month": 7, "year": 2026, "income": 18500000, "paidCount": 37, "debtors": 5 },
  "queue": { "grading": 2, "pendingPurchases": 1 } }
```

- `today.attendanceRate` — davomat hali belgilanmagan bo'lsa `null`.
- `audience` ∈ `"all" | "role" | "group" | "debtors"`. `role` tanlansa `role` majburiy (aks holda `400 ROLE_REQUIRED`),
  `group` tanlansa `groupId` majburiy. `includeParents: true` — guruh/qarzdorlar tanlanganda ota-onalarga ham yuboriladi.
- E'lon in-app bildirishnoma sifatida saqlanadi va **Telegramga ham ketadi** (bog'langanlarga).
- **`NotificationType` kengaytirildi:** `"points" | "payment_reminder" | "test_result" | "attendance" | "announcement"`.
  `announcement` — admin yuborgan ommaviy e'lon.
- CSV fayllar `;` ajratgichli va BOM bilan (Excel to'g'ri ochadi).

**Sozlamalar kengaytirildi:** `GET/PATCH /settings` endi `monthlyFee` (standart oylik to'lov, so'm) ni ham qaytaradi:
`{ teacherPointLimit: 20, initialPoints: 100, monthlyFee: 450000 }`.

**Rate limit:** `/auth/login` — 30 so'rov/daqiqa (bitta IP), `/auth/register` — 10/daqiqa, qolgan endpointlar — 300/daqiqa.
Markazda hamma bitta Wi-Fi'dan kirishi mumkinligi hisobga olingan.

> **Admin panel:** backend `/admin` manzilida tayyor boshqaruv panelini o'zi beradi
> (`http://localhost:3001/admin`). U shu kontraktdagi endpointlardan foydalanadi va frontend
> loyihasiga bog'liq emas — frontend AI'si uni qayta yozishi shart emas.

## A.13 Xatolik kodlari (frontend shu kodlarga tayanadi)

| HTTP | code | Qachon |
|---|---|---|
| 400 | `VALIDATION_ERROR` | So'rov tanasi/query noto'g'ri (`message` — birinchi xato matni) |
| 400 | `INVALID_REDIRECT` | Desktop authorize: ruxsat etilmagan qaytish manzili |
| 400 | `DEVICE_MISMATCH` | Desktop kod boshqa qurilma uchun yaratilgan |
| 401 | `INVALID_DESKTOP_CODE` | Desktop kodi noto'g'ri |
| 401 | `DESKTOP_CODE_USED` | Desktop kodi allaqachon ishlatilgan |
| 401 | `DESKTOP_CODE_EXPIRED` | Desktop kodi muddati o'tgan (5 daqiqa) |
| 401 | `INVALID_VERIFIER` | PKCE xavfsizlik tekshiruvi o'tmadi |
| 401 | `UNAUTHORIZED` | Token yo'q, yaroqsiz yoki muddati o'tgan |
| 401 | `INVALID_CREDENTIALS` | Telefon yoki parol xato |
| 401 | `INVALID_REFRESH_TOKEN` | Refresh token yaroqsiz/bekor qilingan |
| 403 | `FORBIDDEN` | Rol yetarli emas yoki begona o'quvchi/guruh |
| 403 | `USER_DEACTIVATED` | Akkaunt o'chirilgan |
| 403 | `POINT_LIMIT_EXCEEDED` | O'qituvchi ball limitidan oshdi |
| 403 | `VIDEO_ACCESS_DENIED` | Videoga kirish huquqi yo'q |
| 403 | `STREAM_TOKEN_INVALID` / `STREAM_TOKEN_EXPIRED` | Video havolasi yaroqsiz/eskirgan |
| 404 | `NOT_FOUND` | Marshrut topilmadi |
| 403 | `NOT_A_STUDENT` | Test topshirish faqat o'quvchi rolida |
| 404 | `USER_NOT_FOUND`, `STUDENT_NOT_FOUND`, `GROUP_NOT_FOUND`, `TEST_NOT_FOUND`, `QUESTION_NOT_FOUND`, `ATTEMPT_NOT_FOUND`, `VIDEO_NOT_FOUND`, `ARTICLE_NOT_FOUND`, `NOTIFICATION_NOT_FOUND`, `FILE_NOT_FOUND` | Obyekt topilmadi |
| 404 | `INVALID_LINK_CODE` | Farzand bog'lash kodi noto'g'ri |
| 404 | `STUDENT_NOT_IN_GROUP` | Guruhdan chiqarishda: o'quvchi bu guruhda emas |
| 409 | `PHONE_TAKEN` | Bu telefon allaqachon ro'yxatdan o'tgan |
| 409 | `DUPLICATE` | Takrorlanuvchi yozuv (unique cheklov) |
| 400 | `GROUP_ID_REQUIRED` | teacher/admin `groupId` siz davomat so'radi |
| 400 | `STUDENT_NOT_IN_GROUP` | Davomat saqlashda begona o'quvchi yuborilgan |
| 400 | `STUDENT_BLOCKED` | Bloklangan (faol bo'lmagan) o'quvchiga davomat/to'lov holati belgilamoqchi — yozuvlar o'chirilmaydi, saqlanmaydi ham |
| 400 | `TEACHER_NOT_FOUND` | Guruhga o'qituvchi biriktirishda noto'g'ri `teacherId` |
| 400 | `ATTEMPT_FINISHED` | Topshirilgan testga javob yozilmoqchi |
| 400 | `ATTEMPT_NOT_SUBMITTED` / `ATTEMPT_NOT_COMPLETED` | Hali topshirilmagan/baholanmagan |
| 400 | `QUESTION_NOT_IN_ATTEMPT`, `NOT_MANUAL_QUESTION`, `SCORE_OUT_OF_RANGE` | Baholashdagi xatolar |
| 400 | `TEST_EMPTY` | Testda savol yo'q (start qilib bo'lmaydi) |
| 400 | `CORRECT_ANSWER_REQUIRED`, `OPTIONS_REQUIRED` | Savol qo'shishda: listening/reading uchun javob, MCQ uchun variantlar shart |
| 404 | `MOCK_EXAM_NOT_FOUND`, `MOCK_SECTION_NOT_FOUND`, `MOCK_GROUP_NOT_FOUND`, `MOCK_QUESTION_NOT_FOUND`, `MOCK_ATTEMPT_NOT_FOUND` | Mock obyekt topilmadi |
| 409 | `MOCK_SECTION_EXISTS` | Bu skill uchun bo'lim allaqachon mavjud |
| 400 | `MOCK_EXAM_EMPTY`, `MOCK_EXAM_NOT_PUBLISHED`, `MOCK_ATTEMPT_FINISHED`, `MOCK_ATTEMPT_NOT_SUBMITTED`, `MOCK_ATTEMPT_NOT_COMPLETED`, `QUESTION_NOT_IN_EXAM`, `NOT_MANUAL_QUESTION`, `NO_FILE` | Mock oqimidagi xatolar |
| 402 | `MOCK_PAYMENT_REQUIRED`, `MOCK_PURCHASE_PENDING` | Mock uchun to'lov kerak / tasdiq kutilmoqda |
| 400 | `MOCK_TIME_UP`, `MOCK_ALREADY_ACCESSIBLE`, `NO_QUESTIONS_PARSED`, `MISSING_ANSWERS`, `NOT_SPEAKING_QUESTION` | Mock v2 (rejim/parse/speaking) xatolari |
| 400 | `FILE_REQUIRED`, `INVALID_FILE_TYPE`, `FILE_TOO_LARGE`, `INVALID_FILE_KEY` | Video/rasm yuklashda |
| 400 | `VIDEO_ALREADY_ACCESSIBLE` | Allaqachon ochiq videoni sotib olmoqchi |
| 400 | `TELEGRAM_DISABLED` | Bot sozlanmagan (`TELEGRAM_BOT_TOKEN` yo'q) |
| 400 | `ROLE_REQUIRED` | `POST /notifications/broadcast` da `audience: "role"` tanlangan, lekin `role` berilmagan |
| 429 | `TOO_MANY_REQUESTS` | Rate limit (login: 30/daqiqa, register: 10/daqiqa, qolgani: 300/daqiqa) |
| 500 | `INTERNAL_ERROR`, `LINK_CODE_GENERATION_FAILED` | Kutilmagan xatolik |
