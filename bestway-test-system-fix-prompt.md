# Task: Fully Remediate the Test/Mock-Exam System Issues in `algorithco/bestway`

You are working on the repository `algorithco/bestway`, specifically the **Tests** system (`backend/src/tests/*`, `/v1/tests/*`) and the **Mock Exam** system (`backend/src/mock/*`, `/v1/mock/*`, `frontend/src/components/mock/*`). A code review found real, verified bugs and documentation/UI inconsistencies in this area. Fix **every item below, one at a time, in the exact order given**. Do not skip, merge, or partially address any item. After each fix, run the relevant build/lint/test command and confirm it passes before moving to the next item. Do not change unrelated UI/UX/behavior. For every item: read the affected file(s) first, make the minimal correct fix, verify it builds, then write a one-paragraph note describing exactly what changed and why. At the very end, produce a single consolidated changelog of everything you touched.

---

## TASK 1 (Critical — fix first): `bandFromRaw()` discards the band table's own zero-score entry

**File:** `backend/src/mock/mock-scoring.ts` (function `bandFromRaw`, lines ~129-144)

**Problem:**
```ts
export function bandFromRaw(...): number {
  if (max <= 0) return 0;
  if (score <= 0) return 0;   // <-- BUG: bypasses the table entirely
  const scaled = Math.round((Math.max(0, Math.min(score, max)) / max) * 40);
  const table = tableFor(skill, examType, tables);
  for (const [minRaw, band] of table) {
    if (scaled >= minRaw) return band;
  }
  return 0;
}
```
Every default band table (`DEFAULT_LISTENING_TABLE`, `DEFAULT_ACADEMIC_READING_TABLE`, `DEFAULT_GENERAL_READING_TABLE`) explicitly defines a `[0, 2]` (or similar) row, meaning the official IELTS convention is that a raw score of 0 still maps to band 2 (never band 0). The `if (score <= 0) return 0;` guard short-circuits before the table lookup, so:
- This row is **dead code** — it can never be reached for `score === 0`.
- A student who answers every question and gets all of them wrong receives the same result (band 0) as a student who never attempted any question at all — the system cannot distinguish "attempted, failed" from "did not attempt," which hides real information from teachers reviewing results.
- The computed `overallBand` (average of listening/reading/writing/speaking) is understated for any student who scored 0 raw points on an auto-graded skill, because the code uses 0 instead of the officially-defined 2.

**Fix requirements:**
1. Determine, and make explicit, the actual intended behavior. There are two legitimate options — pick the one that matches the product's actual grading policy (check `TESTS_AND_MOCKS.md`, ask/infer from surrounding comments, or default to standard IELTS behavior if no other signal exists):
   - **Option A (match official IELTS convention):** Remove the `if (score <= 0) return 0;` shortcut entirely and let the table lookup run for `scaled === 0` as well, so a genuinely-attempted 0-raw-score result correctly returns whatever band the table's zero-row specifies (e.g. 2).
   - **Option B (intentionally distinguish "no attempt" from "attempted, scored 0"):** Keep a zero-score special case, but make it explicit and correct: add a separate `attempted: boolean` (or `answeredCount: number`) parameter to `bandFromRaw`, so that "no answers submitted at all" returns `0` deliberately, while "answered everything, scored 0 raw points" correctly falls through to the table and returns the table's zero-row band (e.g. 2). Update every call site (`mock-grading.service.ts:364` and any others found via `grep -rn "bandFromRaw" backend/src`) to pass the correct `attempted`/`answeredCount` value.
2. Add/update unit tests for `bandFromRaw` (create `backend/src/mock/mock-scoring.spec.ts` if it doesn't exist) covering: `score=0, max=40` with and without attempted answers, `score<0` (should never happen but must not crash), `max=0`, and a normal mid-range score, for both `listening` and `reading` (academic + general) skills.
3. Verify: `cd backend && npm run test` (or the project's actual test command — check `package.json`) passes, and manually trace through `mock-grading.service.ts` to confirm the change doesn't break `overallBand` computation or any grading endpoint.

---

## TASK 2: Fix the misleading "Duration" field on Listening sections in Mock Exam authoring

**Files:**
- `frontend/src/components/mock/mock-section-dialog.tsx`
- `backend/src/mock/mock-shape.ts` (`computeSkillTiming`, `totalDuration`) — reference only, do not change the timing logic itself, it is correct and intentional

**Problem:** `MockSectionDialog` shows a numeric "Duration (minutes)" input for every skill, including `listening`, and this value is saved to `MockSection.durationMinutes`. However, the backend's `computeSkillTiming()` in `mock-shape.ts` explicitly and intentionally **never uses `durationMinutes` for the listening skill** — actual listening timing is always derived from the sum of `audioDurationSec` across the section's groups plus a 120-second review buffer. Worse, `totalDuration()` still sums `durationMinutes` across **all** sections including listening for the exam card's displayed "X min" total, so the UI shows a number that has no relationship to the real timed behavior a student will experience.

This means a teacher/admin can type "30" into the Listening section's Duration field, believe they've set a 30-minute listening limit, and the number silently does nothing — while also polluting the exam's displayed total duration with a misleading figure.

**Fix requirements:**
1. In `MockSectionFields` (inside `mock-section-dialog.tsx`), when `skill === "listening"`:
   - Hide the Duration input entirely, OR (preferred, since some admins may still want a soft reference number) keep it visible but disabled-looking with inline helper text directly under the field explaining that listening timing is derived automatically from uploaded audio length + a 2-minute review buffer, and this field is not used for the timer.
   - Do not send `durationMinutes` in the create/update payload for listening sections if you choose to hide the field (send `undefined`), to avoid storing a meaningless number in the database going forward.
2. Apply the same fix to any other place in the codebase that renders a duration input for a mock section without skill-awareness — search with `grep -rln "durationMinutes" frontend/src/components/mock` and check each file (`mock-exam-detail-view.tsx`, `mock-exams-view.tsx`, `mock-manage-view.tsx`, `exam-builder/types.ts`, and the actual `/exam-builder` route pages under `frontend/src/app/[locale]/(app)/exam-builder/`) for the same listening-duration-input issue. Fix every instance found, not just the one in `mock-section-dialog.tsx`.
3. Fix `totalDuration()` in `mock-shape.ts` so it does not add a listening section's stored `durationMinutes` into the displayed total (since it's not used for timing). Instead, for listening sections, the total should reflect the sum of `audioDurationSec` (converted to minutes, rounding up) plus the 120-second review buffer, matching what `computeSkillTiming` actually does — so the displayed "X min" total on exam cards is truthful and consistent with the real timed experience.
4. Add a code comment at the top of `totalDuration()` cross-referencing `computeSkillTiming()` so future editors don't reintroduce the mismatch.
5. Verify: `cd frontend && npm run build && npx tsc --noEmit` passes. Manually confirm in the UI (or via a quick component test) that creating a listening section no longer exposes a functional-looking duration input that does nothing, and that an exam's displayed total duration changes correctly when audio is uploaded to a listening group.

---

## TASK 3: Reconcile stale documentation with the actual Mock Exam authoring UI, and remove/merge duplicate authoring paths

**Files:**
- `TESTS_AND_MOCKS.md` §5.5
- `frontend/src/components/mock/mock-section-dialog.tsx`, `mock-questions-dialog.tsx`, `mock-manage-view.tsx`
- `frontend/src/app/[locale]/(app)/exam-builder/` (the actual current authoring route)
- `frontend/src/components/mock/exam-builder/` (leftover files: `QuestionEditor.tsx`, `types.ts`)

**Problem:**
1. `TESTS_AND_MOCKS.md` §5.5 describes a "Wizard (active)" flow — `ExamBuilderWizard` in `components/mock/exam-builder/` with setup / per-skill part editors / review steps — that **does not exist anywhere in the codebase**. The real, current authoring flow lives at the `/exam-builder/new` and `/exam-builder/[id]` routes under `frontend/src/app/[locale]/(app)/exam-builder/`, which the documentation never mentions by path.
2. The documentation also references a `MockExamCreateDialog` component that **does not exist as a file** anywhere in the repo (confirmed via `grep -rln "MockExamCreateDialog" frontend/src` returning nothing beyond the doc mention).
3. The old "Dialogs (granular)" authoring components — `MockSectionDialog`, `MockGroupDialog`, `MockQuestionsDialog` — are labeled in code comments (`mock-exams-view.tsx` line ~130) as "stays in the codebase for reference but is no longer opened" from the exam list, implying they're dead code. **This is false**: `MockSectionDialog`, `MockGroupDialog`, and `MockQuestionsDialog` are still actively imported and used inside `mock-manage-view.tsx`, meaning there are currently **two separate, out-of-sync UIs** that can edit the same `MockSection`/`MockQuestionGroup`/`MockQuestion` data — the modern `/exam-builder` route and the legacy dialog-based `mock-manage-view.tsx`. This is exactly how the Task 2 listening-duration bug is reachable in production today, and it risks further silent data/UX inconsistencies (e.g. different validation rules, different field sets) between the two paths.

**Fix requirements:**
1. Decide the single source of truth for mock exam authoring. Given the codebase comment already states intent ("one primary authoring workflow"), consolidate on the `/exam-builder` route:
   - Audit `mock-manage-view.tsx` to see exactly what functionality it exposes that `/exam-builder` does not (if any). List every such gap explicitly in your summary.
   - Either (a) port any genuinely missing functionality from `mock-manage-view.tsx` into the `/exam-builder` route/components, then remove `mock-manage-view.tsx`'s use of `MockSectionDialog`/`MockGroupDialog`/`MockQuestionsDialog` and redirect users to `/exam-builder/[id]` instead, or (b) if `mock-manage-view.tsx` must remain functional for now, apply the exact same fixes from Task 2 to it and keep both paths in sync going forward, and add a prominent code comment explaining why two paths still exist and what the plan is to unify them.
2. Delete truly dead files: if `frontend/src/components/mock/exam-builder/QuestionEditor.tsx` and `types.ts` are still used by the real `/exam-builder` route, keep them and correct the misleading "Wizard" description in the docs to point at the real route. If they are genuinely unused leftovers from the old wizard, delete them (`grep -rln "exam-builder/QuestionEditor\|exam-builder/types" frontend/src` first to be sure nothing imports them).
3. Rewrite `TESTS_AND_MOCKS.md` §5.5 to accurately describe the actual current authoring flow: correct file paths, correct component names, and explicitly state whether the legacy dialogs are still live (and if so, why) or have been removed.
4. Remove the reference to the nonexistent `MockExamCreateDialog` from the documentation, or replace it with the actual component/route that performs exam creation today.
5. Do a final full read-through of `TESTS_AND_MOCKS.md` end to end and flag (in your summary, not necessarily fix unless trivial) any other place where it describes something that no longer matches the code — the doc itself already admits in §4.7 that `backend/api-contract.md` §A.7b is stale, so check that file too for the same kind of drift and note what you find.
6. Verify: `cd frontend && npm run build && npx tsc --noEmit` passes with no unused-import errors after any deletions.

---

## Acceptance Criteria (must all be true before you consider this done)

- [ ] `bandFromRaw()` no longer silently discards the band table's own definition for a zero raw score; the chosen behavior (Option A or B from Task 1) is implemented consistently across all call sites.
- [ ] Unit tests exist and pass for `bandFromRaw()` covering the zero-score case.
- [ ] The Listening section "Duration" input no longer misleads authors into thinking it controls exam timing — either hidden or clearly labeled as non-functional for timing purposes, in every component that renders it.
- [ ] `totalDuration()` no longer includes a listening section's unused `durationMinutes` in the displayed total; it reflects audio-based timing instead.
- [ ] There is exactly one documented, accurate authoring flow for mock exams — either the legacy dialogs are removed, or they are fixed and explicitly kept in sync with `/exam-builder`, with the reasoning documented.
- [ ] `TESTS_AND_MOCKS.md` §5.5 (and any other section found to be stale) accurately reflects the real file paths and component names in the current codebase.
- [ ] `npm run build` / `npx tsc --noEmit` pass in both `backend` and `frontend` after all changes.
- [ ] A final changelog listing every file changed and why is provided at the end, including an explicit list of any documentation-vs-code mismatches found but not yet fixed (if any remain out of scope).

Work through the tasks strictly in order (1 → 3). Do not declare the job finished until every checkbox above is genuinely satisfied.
