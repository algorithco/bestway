# BestWay Tests & Mocks — Complete Guide

> Everything about creating tests, taking exams, grading, mock exams, audio,
> certificates, anti-cheat, and the desktop runner. Base API URL is `/v1`
> (`backend/src/main.ts:36`), so e.g. controller prefix `tests` =
> `http://localhost:3001/v1/tests/*`.

Two parallel systems exist — do not mix them up:

| System | Models | API prefix | Purpose |
|---|---|---|---|
| **Tests** (simple / question bank) | `Test`, `Question`, `TestAttempt`, `Answer`, `AntiCheatEvent` | `/v1/tests/*` | General center tests: IELTS / Multilevel practice, auto + manual grading |
| **Mocks** (full exam simulation) | `MockExam`, `MockSection`, `MockQuestionGroup`, `MockQuestion`, `MockAttempt`, `MockAnswer`, `MockCheatEvent`, `MockPurchase` | `/v1/mock/*` | Real-exam simulation: bands 0–9, CEFR, timed/full-test flow, purchases |

---

## 1. Data model (Prisma)

### 1.1 Test enums — `backend/prisma/schema.prisma:40-63`

| Enum | Values |
|---|---|
| `TestType` | `ielts`, `multilevel` |
| `TestSection` | `listening`, `reading`, `writing`, `speaking` |
| `QuestionType` | `multiple_choice`, `short_answer`, `essay`, `speaking_prompt` |
| `AttemptStatus` | `in_progress`, `grading`, `completed` |

Manual (teacher-graded) sections: `writing`, `speaking`
(`backend/src/tests/tests.service.ts:13`). `listening`/`reading` are auto-graded.

### 1.2 Test models

**`Test`** (`schema.prisma:289-302`): `id`, `type`, `title`,
`level?` (`B2`, `Academic`), `isDemo=false` (guest-visible),
`isActive=true` (students only see active), `durationMinutes?`,
`sectionQuestionCounts?` (e.g. `{"listening":10}` — random-pick counts),
relations `questions[]`, `attempts[]`.

**`Question`** (`schema.prisma:304-325`): `id`, `testId` (cascade delete),
`section`, `type`, `prompt`, `options?` (`string[]` for `multiple_choice`),
`correctAnswer?` (auto-graded; `|`-separated alternatives),
`maxScore=1`, `audioUrl?` (storage key, e.g. `tests/<uuid>.mp3`),
`passageText?` (long reading text), `instructions?` (e.g. `Listen and answer…`).

**`TestAttempt`** (`schema.prisma:327-347`): `id`, `studentId`, `testId`,
`status=in_progress`, `questionOrder` (`string[]` — this attempt's shuffled order),
`autoScore?`, `manualScore?`, `totalScore?`, `antiCheatCount=0`,
`startedAt`, `finishedAt?`.

**`Answer`** (`schema.prisma:360-375`): `id`, `attemptId` + `questionId`
(cascade, unique together — one row per question per attempt),
`answer` (raw text; MC stores the chosen option string), `score?`,
`isGraded=false`, `gradedById?`, `comment?`.

**`AntiCheatEvent`** (`schema.prisma:349-358`): `id`, `attemptId` (cascade),
`event` (e.g. `tab_switch`), `createdAt`.

### 1.3 Mock enums — `schema.prisma:522-565`

| Enum | Values |
|---|---|
| `MockExamType` | `ielts_academic`, `ielts_general`, `multilevel` |
| `MockSkill` | `listening`, `reading`, `writing`, `speaking` |
| `MockQuestionType` (15) | `multiple_choice`, `multi_select`, `true_false_notgiven`, `yes_no_notgiven`, `matching`, `matching_headings`, `sentence_completion`, `note_completion`, `summary_completion`, `table_completion`, `short_answer`, `map_labelling`, `essay_task1`, `essay_task2`, `speaking_task` |
| `MockAttemptStatus` | `in_progress`, `grading`, `completed` |
| `MockAttemptMode` | `practice` (untimed), `timed` |

### 1.4 Mock models

**`MockExam`** (`schema.prisma:568-588`): `type`, `title`, `description?`,
`level?`, `isPublished=false`, `isDemo=false`, `price=0` (0 = free),
`isFreeForApproved=true`, `createdById?`. Relations: `sections[]`,
`attempts[]`, `purchases[]`.

**`MockPurchase`** (`schema.prisma:591-607`): `userId` + `examId` (unique),
`status=pending_confirmation` (`pending_confirmation` → `purchased`),
`method=manual` (cash, like videos), `amount`, `confirmedById?`.

**`MockSection`** (`schema.prisma:610-624`): one row per skill per exam
(unique `[examId,skill]`), `title?`, `sortOrder`, `durationMinutes?`
(reading/writing ≈ R60/W60; listening stores it only as legacy reference —
timing is audio-derived, see §4.4), `instructions?`.

**`MockQuestionGroup`** (`schema.prisma:628-647`): a block sharing material —
e.g. *Questions 1–5: Complete the notes*. `title?`, `instructions?`,
`passageText?`, `audioKey?`, `imageKey?` (maps/diagrams), `partNumber?`
(Listening 1–4), `audioPlayLimit=1`, `audioDurationSec?`.

**`MockQuestion`** (`schema.prisma:649-667`): `groupId` (cascade), `number`
(1–40 in exam), `sortOrder`, `type`, `prompt`, `options?`, `correctAnswers?`
(`string[]`), `points=1` (IELTS writing/speaking forced to 9 = band),
`wordLimit?` (*NO MORE THAN X WORDS*), `acceptedVariants?`
(e.g. `colour/color`).

**`MockAttempt`** (`schema.prisma:669-701`): `examId`, `studentId`,
`status`, `startedAt`, `submittedAt?`, `finishedAt?`,
`rawScores?` (`{listening:{score:32,max:40}}`), `sectionBands?`
(`{listening:7}`), `overallBand?` (0–9), `cefrLevel?` (A1–C1),
`antiCheatCount=0`, `mode=practice`, `deadlineAt?` (timed),
`annotations?` (highlights), `flowMode?` (`full_test`/`single_skill`),
`currentSkill?`, `sectionDeadlines?`, `overallDeadlineAt?`,
`audioPlays?` (`{groupId:count}` — once-only audio),
`submittedSections?`.

**`MockAnswer`** (`schema.prisma:703-722`): `attemptId` + `questionId`
(unique), `response` (text), `audioKey?` (speaking upload), `isCorrect?`,
`score?`, `isGraded=false`, `gradedById?`, `feedback?`,
`rubricScores?` (writing `{TA,CC,LR,GRA}` / speaking
`{fluency,lexical,grammar,pronunciation}`, 0–9).

**`MockCheatEvent`** (`schema.prisma:724-733`): `attemptId` (cascade),
`event`, `createdAt`.

---

## 2. Tests backend API (`/v1/tests/*`)

Controller: `backend/src/tests/tests.controller.ts:41`. DTOs:
`backend/src/tests/dto/tests.dto.ts`.

| # | Method + Path | Who | Body / Query |
|---|---|---|---|
| 1 | `GET /tests?type=&page=&limit=` | optional auth (guest/parent → demo only; student → active; staff → all) | `QueryTestsDto` |
| 2 | `GET /tests/demo/list` | public | demo + active only |
| 3 | `GET /tests/demo/:id` | public | sanitized (no `correctAnswer`) |
| 4 | `POST /tests/demo/:id/submit` | public | `{answers:{qid:answer}}` → instant score, no DB write |
| 5 | `POST /tests` | admin, super_admin | `CreateTestDto`: `type!`, `title!` (3–200), `level?`, `isDemo?`, `durationMinutes?` (1–600), `sectionQuestionCounts?` |
| 6 | `GET /tests/attempts?status=&studentId=&testId=` | teacher, admin, super_admin (teachers: own groups only) | `QueryAttemptsDto` |
| 7 | `GET /tests/attempts/mine` | student | own history |
| 8 | `GET /tests/attempts/:attemptId` | auth + must own / staff of group | attempt + ordered questions; staff also get `correctAnswer` + `cheatEvents` |
| 9 | `POST /tests/attempts/:attemptId/answer` | student | `{questionId!, answer!}` (empty string = erase) |
| 10 | `POST /tests/attempts/:attemptId/flag-cheat` | student, 30/min throttle | `{event!}` e.g. `tab_switch` |
| 11 | `POST /tests/attempts/:attemptId/submit` | student | — → `{status, autoScore}` |
| 12 | `POST /tests/attempts/:attemptId/grade` | teacher, admin, super_admin | `{questionId!, score!, comment?}` — manual sections only |
| 13 | `GET /tests/attempts/:attemptId/certificate` | auth (owner/staff) | PDF, only when `completed` |
| 14 | `POST /tests/questions/:questionId/audio` | admin, super_admin | multipart `audio` (audio/*, ≤50 MB) |
| 15 | `GET /tests/questions/:questionId/audio` | public (demo audio is public) | streams file, Range/`206` supported |
| 16 | `PATCH /tests/questions/:questionId` | admin, super_admin | `UpdateQuestionDto` (all optional) |
| 17 | `DELETE /tests/questions/:questionId` | admin, super_admin | also deletes audio file |
| 18 | `GET /tests/:id` | auth (staff get `+questions` with answers) | detail |
| 19 | `PATCH /tests/:id` | admin, super_admin | `UpdateTestDto` (+ `isActive`) |
| 20 | `POST /tests/:id/start` | student | — → attempt (resumes `in_progress`) |
| 21 | `POST /tests/:id/questions` | admin, super_admin | `CreateQuestionDto` (see §3) |

> Route order matters: `attempts/…`, `questions/…`, `demo/…` are declared
> before `:id` so they aren't shadowed (`tests.controller.ts:39`).

### 2.1 Attempt lifecycle

**Start** (`POST :id/start`, `tests.service.ts:435-496`):
must have student profile (`403 NOT_A_STUDENT`), test active, else resume
existing `in_progress` (`resumed:true` + `savedAnswers`); otherwise random
per-section select + Fisher-Yates shuffle (`crypto.randomInt`), honoring
`sectionQuestionCounts`; empty pool → `400 TEST_EMPTY`. Response
`{attemptId, resumed, durationMinutes, startedAt, questions}` — questions are
sanitized (no `correctAnswer`; audio as endpoint URL).

**Answer** (`tests.service.ts:499-515`): owner-only, must be `in_progress`
(`ATTEMPT_FINISHED`), deadline enforced (`TEST_TIME_UP`), question must be in
`questionOrder` (`QUESTION_NOT_IN_ATTEMPT`); upsert on
`[attemptId,questionId]`.

**Submit** (`grading.service.ts:41-105`): auto-scores listening/reading
(`maxScore` or 0 each); any non-empty writing/speaking answer flips status to
`grading`, else `completed`; `completed` notifies student + parents,
`grading` notifies the group teacher.

**Grade** (`grading.service.ts:111-159`): submitted only, teacher scoped to own
group, manual sections only (`NOT_MANUAL_QUESTION`), `score ≤ maxScore`;
when all manual answers graded → `completed` with
`totalScore = autoScore + manualScore`, notifications sent.

### 2.2 Auto-grading rule (tests)

```ts
normalize = lower + trim + collapse spaces
correct if correctAnswer.split('|').some(v => normalize(v) === normalize(answer))
// empty answer is never correct; all-or-nothing per question
```

`correctAnswer` example: `1987|nineteen eighty seven`. Used identically in
`grading.service.ts:25-34` and demo scoring `tests.service.ts:560-569`.

### 2.3 Audio

Upload `POST questions/:id/audio` stores `STORAGE_DIR/tests/<uuid>.<ext>`
(path-confined, old file deleted). Students never see the key — API maps it to
`/v1/tests/questions/:id/audio`, streamed publicly with Range support.

### 2.4 Certificates

`GET attempts/:attemptId/certificate` (completed only) → pdfkit A4 PDF:
center name, `NATIJA SERTIFIKATI`, student, per-section table, total, date,
certificate ID = attemptId (`certificate.service.ts`, `grading.service.ts:320-352`).

### 2.5 Anti-cheat

`POST attempts/:attemptId/flag-cheat {event:"tab_switch"}` — student role,
30/min throttle, capped at 50 events per attempt (warn-only),
`antiCheatCount` incremented and shown in every attempt summary; full event
list is staff-only (`tests.service.ts:518-530`).

---

## 3. Adding test questions (fields & rules)

`CreateQuestionDto` (`dto/tests.dto.ts:98-144`):

| Field | Rule |
|---|---|
| `section!` | `listening\|reading\|writing\|speaking` |
| `type!` | `multiple_choice\|short_answer\|essay\|speaking_prompt` |
| `prompt!` | min 3 chars; use `___` for blanks |
| `options?` | required (≥2) when `type == multiple_choice` |
| `correctAnswer?` | required when section is listening/reading; `a\|b\|c` alternatives |
| `maxScore?` | 1–100, default 1 |
| `passageText?` | ≤10 000 chars (reading material) |
| `instructions?` | ≤2 000 chars (e.g. *Write ONE WORD ONLY*) |
| `audioUrl?` | storage key — normally set via audio upload, not by hand |

Grading branches on **section**, not type: listening/reading = auto,
writing/speaking = manual.

---

## 4. Mock backend API (`/v1/mock/*`)

Controller `backend/src/mock/mock.controller.ts:56` (44 routes). Services:
`mock-attempt`, `mock-grading`, `mock-authoring`, `mock-access`,
`mock-certificate` + pure helpers `mock-answer.ts` (matching),
`mock-scoring.ts` (bands/CEFR), `mock-shape.ts` (sanitizing),
`mock-parse.ts` (paste import), `mock-storage.ts` (media).

### 4.1 Exams & authoring

| Method + Path | Who | Notes |
|---|---|---|
| `GET /mock/exams?type=` | optional auth | staff: all; student: published/demo; guest: demo only |
| `POST /mock/exams` | teacher, admin, super_admin | `{type!, title! 3–200, description?, level?, isDemo?, price?≥0, isFreeForApproved?}` |
| `GET /mock/exams/:id` | optional auth | staff: full + keys; student: sanitized; locked: metadata only |
| `PATCH /mock/exams/:id` | teacher (own), admin, super_admin | settings incl. `isPublished/isDemo/price` |
| `DELETE /mock/exams/:id` | super_admin only | deletes media too |
| `POST /mock/exams/:id/clone` | teacher, admin, super_admin | deep copy, unpublished, media not copied |
| `GET /mock/exams/:id/readiness` | teacher, admin, super_admin | checklist: sections, 4 listening parts, audio, writing tasks, answer keys, points |
| `GET /mock/exams/:id/preview` | teacher, admin, super_admin | student view without keys |
| `POST /mock/exams/:id/sections` | teacher, admin, super_admin | `{skill!, title?, durationMinutes? 1–300, instructions?}` — one per skill |
| `PATCH/DELETE /mock/sections/:sectionId` | same | — |
| `POST /mock/sections/:sectionId/groups` | same | `{title?, instructions?, passageText?≤20000, partNumber? 1–4, audioDurationSec?, audioPlayLimit? 1–10}` |
| `PATCH/DELETE /mock/groups/:groupId` | same | — |
| `POST /mock/groups/:groupId/media` | same, multipart ≤500 MB | `audio?` + `image?` fields |
| `GET /mock/groups/:groupId/audio?attemptId=` | optional auth | Range streaming; replay-counted in strict mode |
| `GET /mock/groups/:groupId/image` | optional auth | — |
| `POST /mock/groups/:groupId/questions` | same | batch 1–60: `{number! 1–200, type!, prompt!≤5000, options?, correctAnswers?, acceptedVariants?, points? 1–20, wordLimit?}` |
| `POST /mock/groups/:groupId/questions/import` | same | `{text!≤20000, answers? {"1":"B"}, points?}` — paste import |
| `POST /mock/parse-questions` | same | dry-run parse preview, no DB write |
| `PATCH/DELETE /mock/questions/:questionId` | same | — |

Authoring validation: option types (`multiple_choice, multi_select,
matching, matching_headings`) need ≥2 options; auto-skill questions need
≥1 correct answer; IELTS writing/speaking must be `points == 9` (= band).

### 4.2 Mock attempts — student

| Method + Path | Notes |
|---|---|
| `POST /mock/exams/:id/start` | `{mode?: practice\|timed, flow?: single_skill\|full_test}`; resumes `in_progress`; empty exam → `MOCK_EXAM_EMPTY`; access enforced (402 if locked/pending) |
| `POST /mock/attempts/:id/answer` | `{questionId!, response!≤10000}` (empty = clear), upsert |
| `POST /mock/attempts/:id/answers` | bulk 1–200 |
| `POST /mock/attempts/:id/speaking/:questionId` | multipart audio ≤25 MB, must be speaking question |
| `PUT /mock/attempts/:id/annotations` | highlights/notes JSON |
| `POST /mock/attempts/:id/flag-cheat` | 30/min, cap 50, warn-only |
| `POST /mock/attempts/:id/submit` | auto-grade L/R, bands, or `grading` if manual pending; optional `{skills:[...]}` grades only those sections (section-only submit) |
| `POST /mock/attempts/:id/advance` | full-test flow: listening → reading → writing (no going back) |
| `GET /mock/attempts/mine` | own history |
| `GET /mock/attempts/:attemptId` | detail; keys revealed to students only after `completed`; cheat list staff-only |
| `GET /mock/attempts/:id/answers/:qid/audio` | speaking recording stream |
| `GET /mock/attempts/:attemptId/certificate` | band/CEFR PDF, completed only |

### 4.3 Mock attempts — staff control

`GET /mock/attempts` (teachers: own groups), `POST …/grade`
`{questionId!, score! (0.5 steps allowed), feedback?, rubricScores?}`,
`POST …/force-submit`, `POST …/extend {minutes 1–180}`,
`POST …/reopen` (grading → in_progress), `DELETE …` (admin+).

### 4.4 Modes & flows

* `practice` (default): no deadline, unlimited audio replays, native audio controls.
* `timed`: skill-specific deadlines (IELTS rules, `computeSkillTiming` in
  `mock-shape.ts`): **listening** = Σ `audioDurationSec` + 120s review
  (no audio → 30min fallback; `durationMinutes` never used);
  **reading/writing** = `durationMinutes` (missing → 60min default), strict
  countdown; **speaking** = no deadline at all (`deadlineAt` stays null —
  student submits manually). Single_skill timed attempts also populate
  `sectionDeadlines`; `overallDeadlineAt` = last timed section's deadline
  (speaking skipped; speaking-only exam → both null). Late answers →
  `MOCK_TIME_UP` / `MOCK_SECTION_TIME_UP`.
* `single_skill` (default): any section answerable.
* `full_test`: forced timed, starts at listening, chained per-section
  deadlines, `advance` locks previous sections (`403 SECTION_LOCKED`),
  listening audio plays once (`403 AUDIO_REPLAY_BLOCKED` on replay).

### 4.5 Mock scoring

* Matching is Unicode-aware: case/punctuation-insensitive, hyphens kept,
  articles optional, number↔word (`3↔three`), `acceptedVariants`,
  strict `wordLimit`, exact-set match for `multi_select`
  (`mock-answer.ts`).
* Raw `/40` → band via IELTS tables (Listening ≈ Academic Reading; General
  Reading separate table), 0.5 rounding (`mock-scoring.ts`). Zero raw with at
  least one non-blank answer maps to the table's zero row (standard tables:
  band 2); a section with no answers at all maps to band 0 (`attempted` flag
  in `bandFromRaw`, counted in `mock-grading.service.ts`) — so "attempted,
  scored 0" is distinguishable from "did not attempt".
* `overallBand` = mean of 4 skills (full_test always divides by 4);
  Writing = `(Task1 + 2×Task2)/3`; multilevel has no bands —
  `cefrFromPercent` (C1≥90, B2≥75, B1≥60, A2≥45, A1≥30).
* Manual grading uses `feedback` + `rubricScores`, not `comment`.

### 4.6 Purchases (manual cash, like videos)

1. Student `POST /mock/exams/:id/purchase` → `pending_confirmation`
   (`MOCK_ALREADY_ACCESSIBLE` if already granted).
2. Admin `GET /mock/purchases?status=` → approve
   `POST …/confirm-purchase {userId}` / reject `POST …/reject-purchase`.
3. Locked/pending exams return metadata only; start/stream give
   `402 MOCK_PAYMENT_REQUIRED` / `MOCK_PURCHASE_PENDING`.

### 4.7 Tests vs Mock grading — key differences

| Aspect | Tests | Mock |
|---|---|---|
| Structure | flat questions | Section → Group (passage/audio) → numbered questions |
| Sampling | random subset per `sectionQuestionCounts` | fixed full exam |
| Auto-match | lower+trim+collapse, `\|` split | Unicode fold, hyphen/article/number variants, `wordLimit`, set-exact multi-select |
| Manual trigger | non-empty W/S answer | any ungraded W/S |
| Result | numeric totals | bands 0–9 + CEFR |
| Keys visibility | staff-only, always | students see keys after `completed` |
| Extras | — | force-submit/extend/reopen, flows, purchases, replay limits, annotations |

> `backend/api-contract.md` §A.7b endi kod bilan sinxron (authoring rollari,
> clone/readiness/preview, purchase confirm/reject, force-submit/extend/reopen,
> band nol-qatori, audio-based duration) — farq topsangiz shu faylni yangilang,
> kod manba hisoblanadi.

---

## 5. Adding tests in the web panel (staff)

Entry: `/tests` → staff view → test → `/tests/[id]` (`TestManageView`).
Create needs admin/super_admin; mock authoring also allows teachers.

### 5.1 Create test shell — `TestFormDialog`

`frontend/src/components/tests/test-form-dialog.tsx`: `type`
(ielts/multilevel, create-only), `title` (3–200), `level` (e.g. B2),
`durationMinutes` (1–600, empty = unlimited), `sectionQuestionCounts`
(per-section random-pick counts, empty = all), `isDemo` toggle
(guest-visible), `isActive` toggle (edit-only; hidden from students).

### 5.2 Add/edit questions — `QuestionFormDialog`

`frontend/src/components/tests/question-form-dialog.tsx`: section select
(with icons), type select, `maxScore` (1–100, default 1), `instructions`
(≤2000), `passageText` (≤10000), `prompt` (min 3; `___` for blanks),
MC `options` (one per line, ≥2), `correctAnswer` with `|` alternatives
(shown only for listening/reading), live student preview panel, listening
**audio upload** (`audio/*`, ≤50 MB, preview + chained upload after save).

### 5.3 Gap-fill builder — paste text, get questions

`frontend/src/components/tests/gap-fill-builder.tsx` + `frontend/src/lib/gap-fill.ts`,
opened via **Gap-fill** buttons in `TestManageView`:

1. **Paste** text with blanks as `__________` (2+ underscores). *Load Sadie
   Jones example* fills a demo transport survey.
2. **Parse** — live `{n} gaps found` badge + preview with numbered gap chips;
   warning when no blanks detected.
3. **Section** — listening (default) or reading.
4. **Answers** — one input per gap, `filled/total` progress; `|` for
   alternatives (`High|High Street`); warns when an answer breaks
   *ONE WORD AND/OR A NUMBER*.
5. **Create** — bulk-creates one `short_answer` (1 pt) per blank: prompt =
   its line (`…to the [__2__]`), `passageText` = full numbered text,
   instructions = *Write ONE WORD AND/OR A NUMBER…*.

### 5.4 Manage view ops — `TestManageView`

Search across prompt/answer/options/passage, collapsible per-section cards,
per-row + per-section select with **bulk delete**, local **reorder**
(up/down, preview only), **duplicate** question, **copy as text**, single
delete/edit. Hooks → endpoints: `frontend/src/hooks/use-tests.ts`
(`useCreateTest/UpdateTest/AddQuestion/UpdateQuestion/DeleteQuestion/UploadQuestionAudio`).

### 5.5 Mock authoring — `/exam-builder` (single primary flow)

Staff authoring lives solely in the unified Exam Builder. There is no
`ExamBuilderWizard` and no `MockExamCreateDialog` — those names do not exist
in the codebase. The legacy granular dialogs (`MockSectionDialog`,
`MockGroupDialog`, `MockQuestionsDialog` inside `mock-manage-view.tsx`) were
removed; `/exam-builder/[id]` is the single path that can edit
`MockSection`/`MockQuestionGroup`/`MockQuestion` data.

* **Routes** (`frontend/src/app/[locale]/(app)/exam-builder/`): list →
  `ExamBuilderList` (`page.tsx`); create shell → `ExamSetup`
  (`new/page.tsx`: type cards, title ≥3, description/level/price/
  `isFreeForApproved`, always DRAFT, then `router.push(/exam-builder/${id})`);
  edit → `ExamBuilder` (`[id]/page.tsx`, `examId` prop). Staff visiting
  `/mock/[id]` are redirected to `/exam-builder/[id]`; students/parents see
  `MockExamDetailView` there instead.
* **Shell** (`frontend/src/components/exam-builder/ExamBuilder.tsx`): Sidebar
  outline nav, `EditorContextBar`, sticky toolbar (Back, Preview, Clone,
  Review with blocker badge, Save Draft, Publish), dirty-guard + `beforeunload`
  protection, live-edit warning banner while published.
* **Sections** (skill-dispatched in `ExamBuilder.tsx`): `ListeningSectionPanel`
  (Parts 1–4 glance, next free part derived), `ReadingSectionPanel`,
  `WritingSectionPanel`, `SpeakingSectionPanel`, generic fallback
  `SectionPanel` (unknown skills only). Listening Duration is disabled +
  informational (timing is audio-derived, see §4.4); reading/writing durations
  are required for Timed mode.
* **Groups = blocks/parts/passages/tasks** (dispatched in `ExamBuilder.tsx`):
  `ListeningPartEditor` (audio upload + `partNumber`/`audioPlayLimit`),
  `ReadingPassageEditor` (passage), `WritingTaskEditor` (Task 1/2),
  `SpeakingTaskEditor` (`speaking_task`), fallback `GroupEditor`.
* **Questions** (shared live core in `frontend/src/components/mock/exam-builder/` —
  NOT dead code): `QuestionEditor.tsx` (schema-driven per-type UI, type-loss
  confirm, student preview) + `types.ts` (`isAutoType`, `QTYPE_LABEL`,
  `newQuestion`, `validatePart`, `defaultSections`). Imported by
  `GroupEditor`, `ListeningPartEditor`, `ReadingPassageEditor`,
  `ReadingSectionPanel`, `ImportPanel`. Bulk import via `ImportPanel`
  (dry-run `POST /mock/parse-questions`, collision/duplicate/canonical
  validation, renumber aid).
* **Settings/readiness/publish**: `OverviewPanel` (title/description/level/
  price/`isFreeForApproved`/`isDemo`, unpublish, super_admin delete),
  `ReviewPanel` (client `examClientChecks` + server `useMockReadiness`,
  per-skill checklists, Fix deep-links, publish gate recheck).
* Settings card parity with the old manage view: title/description/level/price,
  `isPublished` (via Review publish/unpublish only — no direct toggle),
  `isDemo`/`freeForApproved` toggles, clone (list + detail toolbar), readiness
  panel, preview dialog, delete (super_admin). Hooks: `frontend/src/hooks/use-mock.ts`.

### 5.6 Demo tests

`isDemo` flag (tests + mocks) → public guest surface: demo list/detail pages
with `DemoRunner` (instant scoring, no account).

---

## 6. Taking tests on the web (student journey)

`/tests` (role switch) → `StudentTestsView` (**Available** tab: type/level/
duration/section pills + Start; **Results** tab: history) → start
(`POST /tests/:id/start`, resume supported) → `/tests/attempt/:attemptId`
(`AttemptView`: `in_progress` → runner, else review).

**Runner** (`test-runner.tsx`): sticky header (title, answered/total +
progress bar, save indicator, countdown timer, submit), section tabs with
per-section badges, question cards (MC radios / `___` inline inputs /
short-answer with one-word warning / essay textarea + word count / speaking),
`QuestionNav` sticky bottom jump bar, `visibilitychange` → `tab_switch`
flag + warning, autosave (text on blur, radio immediately), submit confirm
dialog with unanswered warning, auto-submit at 0:00.

**Review** (`attempt-review.tsx`): status badge, `totalScore/totalMax` + %
ring, auto/manual split, correct x/y, per-section cards, per-question cards
(correct/incorrect/awaiting-grade, your answer, conditional correct answer,
teacher feedback), staff grading form (score + comment), **certificate PDF**
link (completed only), **Retake**.

Types: `frontend/src/lib/types.ts:412-531`; strings in
`messages/{en,ru,uz}.json` (tests section).

---

## 7. Taking exams on the desktop app (`bestway-tauri`)

Student-only Tauri client talking directly to `/v1`
(`bestway-tauri/src/lib/tests.ts`):

| Function | Endpoint |
|---|---|
| `listTests()` | `GET /tests` |
| `startTest(id)` | `POST /tests/:id/start` (resumes) |
| `saveAnswer()` | `POST /tests/attempts/:id/answer` |
| `submitAttempt()` | `POST /tests/attempts/:id/submit` |
| `myAttempts()` | `GET /tests/attempts/mine` |
| `resolveAudioUrl()` | storage key → absolute `/v1/tests/questions/:id/audio` |

Flow: **Exams** (greeting, assigned/questions/ready stats, type badges,
section chips, Start; `TEST_EMPTY` guard) → **Runner** (answered/total
progress bar, listening **VolumeControl** — React-Bits ElasticSlider,
persisted + broadcast to all `<audio>`; multiple-choice tap-to-answer;
text inputs; sticky bottom bar with submit confirm) → **Result** (animated
score ring, writing/speaking notice, View history / Back) → **History**
(past attempts + score/status pills, feeds Profile stats) + **Profile**
(identity, stats, volume, logout). Lockdown (`Locked`) hides nav during runs.

---

## 8. Hook → endpoint cheat-sheet (web)

Tests (`hooks/use-tests.ts`): `useTests GET /tests`, `useTest GET /tests/:id`,
`useStartTest`, `useSaveAnswer`, `useSubmitAttempt`, `useFlagCheat`,
`useMyAttempts GET /tests/attempts/mine`, `useAttempts`, `useAttempt`,
`useGradeAnswer`, + admin CRUD and audio upload.
Mocks (`hooks/use-mock.ts`): exam CRUD + clone/readiness/preview,
section/group/question CRUD, questions import, media upload.

## 9. Notable error codes

Tests: `TEST_NOT_FOUND, TEST_EMPTY, CORRECT_ANSWER_REQUIRED,
OPTIONS_REQUIRED, ATTEMPT_FINISHED, QUESTION_NOT_IN_ATTEMPT, TEST_TIME_UP,
ATTEMPT_NOT_SUBMITTED, NOT_MANUAL_QUESTION, SCORE_OUT_OF_RANGE,
ATTEMPT_NOT_COMPLETED, NOT_A_STUDENT`.
Mock: `MOCK_EXAM_EMPTY, MOCK_TIME_UP, MOCK_SECTION_TIME_UP, SECTION_LOCKED,
AUDIO_REPLAY_BLOCKED, MOCK_PURCHASE_PENDING, MOCK_PAYMENT_REQUIRED,
MOCK_ALREADY_ACCESSIBLE, MOCK_PURCHASE_NOT_PENDING, MISSING_ANSWERS,
OPTIONS_REQUIRED, CORRECT_ANSWER_REQUIRED, NOT_MANUAL_QUESTION,
SCORE_OUT_OF_RANGE, MOCK_ATTEMPT_NOT_COMPLETED, NOT_A_STUDENT`.
