# IELTS — Exam & Practice-Platform Reference

A complete reference on (1) how the IELTS exam itself works and (2) how IELTS computer-based practice/simulator platforms recreate that exam's UI. Useful as a spec for anyone building, evaluating, or studying with an IELTS practice tool.

> **Note on currency:** IELTS scoring bands, delivery-mode timelines, and third-party platform features can change over time. A verification pass against current sources was done on **7 September 2026** — see [Fact-Check Notes](#fact-check-notes-september-2026) at the end of this document. No information from the original source material has been removed or shortened; corrections/updates are appended as notes rather than overwriting the original figures.

---

## Table of Contents

- [Part 1 — IELTS, the Exam](#part-1--ielts-the-exam)
  - [What IELTS Is](#what-ielts-is)
  - [Structure & Timing](#structure--timing)
  - [Listening](#listening-4-parts--social--academic)
  - [Reading](#reading)
  - [Writing](#writing)
  - [Speaking](#speaking)
  - [Scoring](#scoring)
  - [Delivery Modes](#delivery-modes-relevant-to-ui-work)
- [Part 2 — Practice Platforms & the Exam UI](#part-2--practice-platforms--the-exam-ui)
  - [The Official Computer-Based UI](#the-official-computer-based-ui-what-every-simulator-mimics)
  - [Platform Landscape (2025–2026)](#platform-landscape-20252026)
  - [The Recurring Practice-Exam UI Pattern](#the-recurring-practice-exam-ui-pattern-a-component-spec)
- [Fact-Check Notes (September 2026)](#fact-check-notes-september-2026)

---

## Part 1 — IELTS, the Exam

### What IELTS Is

**IELTS** = International English Language Testing System, jointly owned by the **British Council**, **IDP: IELTS Australia**, and **Cambridge English** (together, the "IELTS Partners").

Taken by people for higher education, migration, and professional registration. Accepted by **11,000+ organizations** worldwide (universities, employers, governments).

**Two content versions:**

| Version | Purpose |
|---|---|
| **IELTS Academic** | Study at degree level or professional registration (doctors, nurses, etc.) |
| **IELTS General Training (GT)** | Migration (UK/AU/CA/NZ…), work, below-degree study |

Listening and Speaking are **identical** in both versions; Reading and Writing **differ**.

**Other variants:**
- **IELTS UKVI** — for UK visas, taken at approved SELT centres.
- **IELTS Life Skills** — A1/B1 speaking + listening only, for family visas.
- **IELTS One Skill Retake** — re-sit a single skill within 60 days.
- **IELTS Online** — remote delivery, Academic only, **not** valid for immigration purposes.

**Results:** Band **0–9** per skill plus an overall band. Validity is **~2 years** (a recommendation, not a hard rule).

**Total test time:** 2 hours 45 minutes
- Listening: ~30 min
- Reading: 60 min
- Writing: 60 min
- Speaking: 11–14 min

### Structure & Timing

| Section | Time | Content | Question count |
|---|---|---|---|
| Listening | ~30 min | 4 parts, played once | 40 (10 per part) |
| Reading | 60 min | 3 passages/sections | 40 |
| Writing | 60 min | 2 tasks (Task 2 worth double) | — |
| Speaking | 11–14 min | 3 parts, human examiner, recorded | — |

### Listening (4 parts — social → academic)

| Part | Format | Typical question types |
|---|---|---|
| **1** | Conversation, everyday social (booking, travel) | Form completion (names, numbers, dates) |
| **2** | One speaker, social/transactional monologue (e.g. speech about facilities) | Map/plan labelling, multiple choice |
| **3** | 2+ speakers, educational context (students + tutor discussing coursework) | Multiple choice, matching |
| **4** | Single academic lecture/monologue | Note/sentence/table completion |

**Key mechanics:**
- Mixed accents: British, Australian, New Zealand, North American.
- Recordings are heard **once only**.
- Questions follow the order of the audio.
- Word limits such as *"NO MORE THAN TWO WORDS AND/OR A NUMBER"* are **strict** — going over the limit means no mark.
- Hyphenated words count as **one** word; contracted forms are not tested.

**Listening question types (6 total):** multiple choice (incl. multi-answer), matching, plan/map/diagram labelling, form/note/table/flow-chart completion, sentence completion, short-answer.

### Reading

- **Academic:** 3 long passages, 2,150–2,750 words total, sourced from books/journals/magazines (undergraduate general-interest level), with increasing difficulty across passages; technical terms come with a mini glossary.
- **General Training (GT):** 3 sections of everyday/work texts —
  - Section 1: notices/adverts/timetables
  - Section 2: workplace texts (job ads, contracts, training)
  - Section 3: one long descriptive/narrative text of general interest
  - Total: 2,150–2,375 words.

**Reading question types:** Academic has **11** types / GT has **8** types —
- Multiple choice
- True/False/Not Given (facts; both modules)
- Yes/No/Not Given (writer's views; **Academic only**)
- Matching information / headings / features / sentence endings (**Academic only**)
- Sentence completion
- Summary/note/table/flow-chart completion
- Diagram label completion
- Short-answer

Key skills tested: skimming, scanning, and precision spelling/grammar when typing answers (marks are lost for typos).

### Writing

| Task | Module | Requirements |
|---|---|---|
| **Academic Task 1** | Academic | ≥150 words, ~20 min. Describe a graph/chart/table/map or a process/diagram — overview + data comparison, academic register, **no opinion**. |
| **GT Task 1** | General Training | ≥150 words. A letter (personal, semi-formal, or formal) built around 3 given bullet points. |
| **Task 2** | Both modules | ≥250 words, ~40 min. Discursive essay: opinion (agree/disagree), discuss both views, advantages/disadvantages, problem–solution, or a two-part question. Common topics: education, environment, technology, health, work, society, crime/law, globalization, media. |

**Rules:** full sentences only (no notes/bullet points); penalty for going off-topic; severe penalty for plagiarism or memorized answers. **Task 2 is weighted 2× Task 1.**

### Speaking

| Part | Duration | Format |
|---|---|---|
| **1** | 4–5 min | Introduction + familiar-topic Q&A (home, work, hobbies) |
| **2** | 3–4 min | Cue card + 1 min prep (pencil/paper notes; on-screen notes for IELTS Online) → 2-minute monologue → 1–2 follow-up questions |
| **3** | 4–5 min | Abstract discussion linked to the Part 2 topic (analyze, speculate, evaluate) |

### Scoring

**Listening/Reading:** 40 items, 1 mark each → raw score converts to a band via a conversion table. These are **approximate official averages**; exact cut points vary per test paper.

| Band | 5 | 6 | 7 | 8 |
|---|---|---|---|---|
| Listening (/40) | 16 | 23 | 30 | 35 |
| Reading Academic (/40) | 15 | 23 | 30 | 35 |
| Reading GT (/40) | 23 | 30 | 35 | — (band 4 ≈ 15) |

**Writing/Speaking:** examiner scores on 4 equal-weight criteria each.
- **Writing:** Task Achievement/Response, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy.
- **Speaking:** Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, Pronunciation.

**Overall band** = mean of the four skill bands, rounded to the nearest half band.
- Averages ending in **.25** round **up** to the next half band (6.25 → 6.5).
- Averages ending in **.75** round **up** to the next whole band (6.75 → 7.0).
- Averages ending in **.125 / .375** round **down** (6.125 → 6.0).

**Band descriptions (0–9):**
9 Expert → 8 Very good → 7 Good → 6 Competent → 5 Modest → 4 Limited → 3 Extremely limited → 2 Intermittent → 1 Non-user → 0 Did not attempt.

**Approximate CEFR mapping:**
- 4.0–5.0 ≈ B1
- 5.5–6.5 ≈ B2
- 7.0–8.0 ≈ C1
- 8.5–9.0 ≈ C2

**Typical entry bars:** undergraduate ~6.0–6.5, most postgraduate programs ~6.5–7.5, nursing/medicine often 7.0+.

### Delivery Modes (relevant to UI work)

| Mode | Details | Results timeline |
|---|---|---|
| **Paper** | Listening answers transferred at the end (10 extra minutes after the audio); Reading is 60 min including transfer time; Writing done by pen on answer sheets. | ~13 days |
| **IELTS on computer (in-centre)** | Same content/scoring as paper. Answers typed as you go — no listening transfer time, just a 2-minute end-of-section review. Reading/Writing layout is identical to IELTS Online. Speaking stays face-to-face with a human examiner. | Typically 1–5 days (commonly 2–3) |
| **IELTS Online (at home)** | Academic only. Runs on the **Inspera Exam Portal**. Listening/Reading/Writing are the same as computer-delivered; Speaking is by video call with a human examiner. AI + human remote proctoring; one screen only; no headphones allowed. **Not accepted for immigration purposes.** | 6–8 days |

**Skills prep ≠ format prep:** examiners stress practicing on the exact interface, because procedural errors (missed navigation, transfer mistakes) cost real marks.

---

## Part 2 — Practice Platforms & the Exam UI

### The Official Computer-Based UI (what every simulator mimics)

Based on IDP's *"How IELTS on computer works"* and the official **Familiarisation test** (free, untimed, at ielts.idp.com / takeielts.britishcouncil.org):

**Global chrome:**
- Countdown timer, top-centre (flashes red in the last 10 and 5 minutes of Reading/Writing).
- **Hide** button, top-right — pauses the screen for bathroom breaks → "Resume test."
- **Settings** — font size (A−/A+), background colour.
- **Help** button — shows how to answer the current question type.

**Listening screen:**
- Audio player with volume control (top-right).
- Full question sheet with typed answers.
- Bottom navigation showing all 40 question slots with back/forward arrows.
- A **"Review"** toggle (lower-left) marks a question — the slot icon changes from a square to a circle.
- Auto-paced by the recording (you **cannot** pause/rewind in the real test).
- ~2 minutes of review time at the end.

**Reading screen:**
- Split screen: passage on the left, questions on the right, independently scrollable (drag the divider).
- Select text → right-click → highlight (colour choices) and notes.
- Free navigation across all questions in the section.
- Answers typed into gaps/option pickers.

**Writing screen:**
- Task text on the left, large answer box on the right.
- Live word counter, bottom-left.
- Answers auto-saved; the candidate can start either task first.

**Everything is autosaved.** When time expires, the system submits automatically.

### Platform Landscape (2025–2026)

#### Official / partner

- **IELTS Familiarisation test** (British Council + IDP) — free, untimed, Listening/Reading/Writing sections, real past questions, near-identical UI (highlight/notes/timer behave slightly differently), no scoring, answer keys shown at the end. Also offers sample-task tests (e.g., GT Reading sentence completion).
- **IELTS Online practice experience** (ielts.org) — the same idea, built for the Inspera remote UI; four sections including a recorded Speaking walkthrough.
- **Road to IELTS** (Clarity English, via British Council) — 300+ interactive activities, ~40 practice tests, videos, "Progress" tracking; sold together with British Council test registrations.
- **IELTS Ready** (takeielts.britishcouncil.org) — free + premium tiers: mock tests, courses, webinars.
- **IELTS by IDP / IELTS Prep apps**, and the **Cambridge past-paper books (1–21)**, are the canonical content source used across the ecosystem.

#### The "exam-simulator" web platforms (the Jumpinto category)

- **Jumpinto** (jumpinto.com) — a computer-based IELTS practice platform that simulates the real test environment at home. From its homepage and user walkthroughs: catalogues real past-paper series ("IELTS Academic 21," "IELTS Academic 18," "IELTS Academic Official Guide," General Training, plus "More Practice Tests"; banner: "IELTS 21 has been released"), Google sign-in, light/dark mode, and a dashboard with "My Last Practice" (resume) plus per-test entry points. Community feedback (Reddit r/IELTS, Facebook groups) describes it as used heavily for realistic computer-format practice and timing, with free access; band estimates are described as "somewhat reliable but not an exact prediction" — Reading/Listening scoring is trusted more than its Writing AI, which some users find inconsistent. TikTok/YouTube guides show checking answers after submission and redoing Speaking inside the flow.
- **ieltsonlinetests.com (IOT)** — the biggest free library (~120 mock tests, a mix of recent actual and Cambridge-sourced tests, 80M+ attempts). Marketing emphasises an "IELTS Side by Side" authentic computer interface, instant band scores, "Locate and Explain" (pinpoints the answer line + explanations), an AI Examiner for Writing/Speaking, progress analytics (average band, study time, weak question types), a free tier, plus paid courses and human-examiner writing evaluation.
- **mini-ielts.com** — free, task-level practice with answers/explanations; simpler than the full simulators.
- **ieltsvault / alfaielts / ieltsfreetests / ieltstestsimulation / bestmytest / ielts-testpro / PrepEx / Magoosh / Engnovate** — the same freemium pattern, with different strengths:
  - **ielts-testpro** markets a clean, modern UI with dark mode, a structured "learning path," instant criterion-based Smart Scoring, and vocabulary/grammar banks.
  - **ieltsvault** sells the "real IELTS interface + timer + exam-style navigation + instant band" experience, built over Cambridge test sets.

### The Recurring Practice-Exam UI Pattern (a component spec)

Across Jumpinto, IOT, ieltsvault, and the official Familiarisation test, the winning exam-screen model is consistent:

1. **Section/part header + clock + controls** — test/section names, part label, countdown timer, hide/settings/help/volume controls.
2. **Content area** —
   - Listening: question sheet sized to the audio flow.
   - Reading: split passage/questions panes with highlight & notes.
   - Writing: task on the left / editor on the right, with word count.
3. **Question palette** — a numbered grid of all 40 questions, with colour/icon states for unanswered, answered, flagged-for-review (square → circle), and current; supports click-to-jump plus prev/next navigation.
4. **Answer widgets matching the real input type** — multiple-choice radio groups, True/False/Not Given and Yes/No/Not Given option rows, gap-fill text boxes, drag/list matching, map click-to-label; strict word-limit enforcement throughout.
5. **Submission + results flow** — timed auto-submit, followed by: an objective band score, per-question right/wrong feedback with the correct answer and its passage/audio location ("Locate & Explain"), audio-transcript sync, a Writing/Speaking AI band estimate per criterion (TR/CC/LR/GRA for Writing; FC/LR/GRA/Pronunciation for Speaking), model answers, and weakness analytics feeding into a dashboard (streaks, history, target band).

**What platforms compete on:** content authenticity (licensing Cambridge/recent actual tests), fidelity to the official UI, AI feedback quality for Writing/Speaking, and progress/analytics UX (learning paths, placement tests, daily plans).

---

## Fact-Check Notes (September 2026)

A verification pass was run against current, publicly available sources on 7 September 2026. **All original figures and details above are kept unchanged** — this section only adds context or flags where public/marketing figures have since moved.

1. **"11,000+ organizations accept IELTS"** — confirmed as accurate and, if anything, conservative. Current British Council / IDP / IELTS.org materials cite figures ranging from roughly 11,500 to over 13,500 organisations across 140–150+ countries, depending on the source and date. The 11,000+ figure in the source document remains a safe floor.
2. **Raw-to-band conversion tables (Listening/Reading)** — the approximate values in the document (16→5, 23→6, 30→7, 35→8 for Listening and Academic Reading) match current third-party and calculator-style references closely. As the document itself notes, exact cut points vary slightly per test paper, and General Training Reading requires a higher raw score than Academic Reading for the same band — both consistent with what's described above.
3. **Overall-band rounding rule** — confirmed: averages ending in .25 round up to the next half band, .75 rounds up to the next whole band, and this is standard IELTS practice.
4. **IELTS Online details** — confirmed via current British Council/IELTS.org pages: it runs on the **Inspera Exam Portal**, uses combined human + AI remote proctoring, requires a single monitor/screen, disallows headphones, and results arrive in **6–8 days**. It is explicitly **not accepted for UK Visas and Immigration (UKVI) or other immigration purposes** — matching the document.
5. **Jumpinto (jumpinto.com)** — confirmed as a real, currently active platform. Independent reviews (as of August 2026) describe it as a four-skill IELTS practice app/website with AI band scoring per criterion, real past-paper content, and a dashboard/resume feature, consistent with the document's description. It also has a companion mobile app ("JumpInto: IELTS Practice Shadow") with added features like a shadowing/pronunciation module and XP/leaderboard gamification not mentioned in the original document — noted here as additional context, not a correction.
6. **ieltsonlinetests.com (IOT)** — confirmed as an active platform; its "Locate and Explain" feature (pinpointing answer locations with explanations) is verified as currently marketed, consistent with the document.
7. **Delivery-mode results timelines** — the paper (~13 days), computer-delivered (1–5 days), and Online (6–8 days) timelines are all consistent with current official guidance, though exact figures can vary slightly by country/test centre.

No factual contradictions were found between the source document and current public information; the verification above is provided as a currency check, not a correction.
