# Task: Build a Visual "Paste & Place" Question Builder for Mock Exam Authoring

## Context (read this fully before writing any code)

Repository: `algorithco/bestway`. Frontend: Next.js 16 / React 19 / Tailwind v4 / TanStack Query, in `frontend/src`. Backend: NestJS in `backend/src`.

The current mock-exam authoring UI lives at `frontend/src/app/[locale]/(app)/exam-builder/[id]/page.tsx` → `frontend/src/components/exam-builder/ExamBuilder.tsx`, with these key existing pieces you MUST reuse rather than duplicate:

- `frontend/src/components/exam-builder/ReadingPassageEditor.tsx` — two-column layout, passage sticky on the left (`xl:grid-cols-[minmax(0,11fr)_minmax(0,13fr)]`), questions scroll on the right. This is the reading-skill entry point.
- `frontend/src/components/exam-builder/ListeningPartEditor.tsx` and `ListeningAudioCard.tsx` — same pattern for listening (audio player instead of passage text).
- `frontend/src/components/exam-builder/GroupEditor.tsx` — the per-group (per-passage/per-part) editor: holds a `BuilderPart` in local state, renders the current list of `BuilderQuestion` items each via `<QuestionEditor>`, and on Save calls `useAddMockQuestions` / `useUpdateMockQuestion` / `useDeleteMockQuestion` / `useUpdateMockGroup` (from `frontend/src/hooks/use-mock.ts`) to sync with the backend. Study `save()` in this file closely — you will call the exact same mutations from your new feature, not new endpoints.
- `frontend/src/components/mock/exam-builder/QuestionEditor.tsx` — a single schema-driven editor that already renders the correct fields (options, correct answers, accepted variants, word limit, points) for all 15 `MockQuestionType` values, driven by `kindOf(type)`. **Do not reimplement this field logic.** You will reuse it inside your new settings drawer.
- `frontend/src/components/mock/exam-builder/types.ts` — exports `BuilderQuestion`, `BuilderPart`, `GROUPED_TYPES`, `QTYPE_LABEL`, `newQuestion()`, `validatePart()`, `isAutoType()`. Reuse all of these; do not create parallel copies.
- `frontend/src/components/exam-builder/types.ts` — exports `TYPES_BY_SKILL` (which question types are legal for `listening`/`reading`/`writing`/`speaking`), `SKILL_META`, `nextQuestionNumber()`, `tx()` (i18n helper with fallback).
- `frontend/src/components/exam-builder/StudentPreview.tsx` — existing live preview component; reuse for the new "preview as student" toggle.
- `frontend/src/lib/gap-fill.ts` — an existing, simpler precedent: parses pasted text for `___` runs into gap segments. Read this for inspiration on paste-handling and segment parsing, but your feature must be far more general (all 15 question types, not just blanks, and manually placed rather than only auto-detected).
- `backend/src/mock/mock-authoring.service.ts` + `mock.controller.ts` — `POST /mock/groups/:groupId/questions` accepts a batch of 1–60 questions: `{number, type, prompt, options?, correctAnswers?, acceptedVariants?, points, wordLimit?}`. This is the endpoint `useAddMockQuestions` already calls — no backend changes are needed for this task unless explicitly noted in Task 7.

## What you are building

A new authoring mode — call it **"Visual paste mode"** — inside the question-authoring area of `GroupEditor.tsx`, alongside (not replacing) the existing per-question form list and the existing `ImportPanel` paste-and-parse mode. The user's own description of the desired UX, verbatim intent:

> The teacher copies a block of question text from somewhere external (a Word doc, PDF, book) and pastes it into the right-hand panel as plain text. Then, wherever inside that pasted text an answer belongs, they click that exact spot and press a toolbar button like "Add multiple choice" or "Add text input." A small interactive widget (a "node," conceptually like a node in n8n) gets inserted right there, inline, without disturbing the surrounding text. Clicking that inserted widget opens a settings panel where they configure it (options, correct answer, points, etc.). This is meant to feel visual and fast — place elements exactly where you want them, then configure each one, rather than filling out a separate form per question in a fixed vertical list.

Build this using **TipTap** (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`), which is the correct tool for "atomic inline nodes embedded in flowing, pasted text" — do not attempt to hand-roll this with raw `contentEditable` or regex-only parsing; it will not handle cursor placement, undo/redo, and paste-cleaning correctly.

---

## TASK 1: Install and scaffold TipTap

1. Add `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder` to `frontend/package.json` (`cd frontend && npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-placeholder`).
2. Create `frontend/src/components/exam-builder/visual-editor/VisualQuestionCanvas.tsx` — a new component that wraps a `useEditor()` instance configured with `StarterKit` (disable headings/blockquote/code-block extensions you don't need — this is meant to hold plain paragraphs of pasted question text, not rich formatting) plus `Placeholder` (placeholder text: "Paste question text here, then use the toolbar to add answer inputs where they belong.").
3. Confirm plain paste works correctly: pasting from Word/PDF should strip inline styles (bold/color/fonts) but preserve line breaks and paragraph structure. Configure `editorProps.transformPastedHTML` or `handlePaste` to sanitize aggressively — plain text semantics only, no rich formatting, since this content becomes exam passage/question text.
4. Verify: `cd frontend && npm run build` passes with the new dependency, and a bare editor renders and accepts pasted text in a throwaway test page or Storybook-less manual check (temporarily mount it in `GroupEditor.tsx` behind a feature flag/dev toggle if there's no test harness).

---

## TASK 2: Define the custom inline "QuestionNode" TipTap extension

**File:** `frontend/src/components/exam-builder/visual-editor/question-node-extension.tsx`

1. Define a TipTap `Node` extension named `questionNode`:
   - `group: "inline"`, `inline: true`, `atom: true` (it behaves as a single, non-editable-from-inside unit in the text flow — like an emoji or mention chip).
   - Attributes: `clientId: string` (stable id, generate via existing `uid()` helper from `frontend/src/components/mock/exam-builder/types.ts`), `questionType: MockQuestionType`.
   - The node itself does **not** store prompt/options/correctAnswers/points in its TipTap attrs as the source of truth — instead, keep a separate React state map `Record<clientId, BuilderQuestion>` in `VisualQuestionCanvas.tsx` (a normal `useState`), keyed by `clientId`, holding the full `BuilderQuestion` object (reuse the existing type, do not invent a new shape). The TipTap node attrs only need `clientId` + `questionType` (for rendering the chip label/icon before the settings are opened) — this keeps the editor's serialized document small and keeps your question data in one canonical place that's easy to reason about, validate, and send to the backend.
2. Implement a `ReactNodeViewRenderer` for this node — a small **chip component** `QuestionChip.tsx`:
   - Shows: a colored badge by type-group (reuse `GROUPED_TYPES` grouping for color coding — e.g. Choice=blue, Fill in=green, Match=purple, Write/Speak=orange), the live-computed question `number` (see Task 4), a short type label (`QTYPE_LABEL[questionType]`), and a small "incomplete" red dot if the question fails validation (empty prompt, no correct answer set, etc. — reuse validation rules already implicit in `validatePart`/`QuestionEditor.tsx`, factor out a `validateOneQuestion(q: BuilderQuestion): string[]` helper if one doesn't already exist as a reusable unit, extracting it from `validatePart` in `mock/exam-builder/types.ts` if needed without changing that function's existing behavior for the old callers).
   - On click: opens the Settings Drawer (Task 3) for that `clientId`.
   - Has a small delete (×) button on hover that removes the node from the document AND deletes its entry from the `clientId → BuilderQuestion` state map.
   - Must be keyboard-navigable and screen-reader labeled (`role="button"`, `aria-label` describing type + number + completion state) — this app cares about accessibility elsewhere (check existing `aria-label` patterns in `ReadingPassageEditor.tsx` for the house style) and this widget must match that bar.
3. Verify the node can be inserted programmatically via `editor.chain().focus().insertContent({...}).run()` at the current cursor/selection position, and that typing/pasting text before/after it does not corrupt or delete it.

---

## TASK 3: Build the Settings Drawer, reusing the existing per-type field editor

**File:** `frontend/src/components/exam-builder/visual-editor/QuestionSettingsDrawer.tsx`

1. This is a slide-in panel (from the right edge of the screen, or a `Sheet`/`Drawer` component — check `frontend/src/components/ui/` for an existing drawer/sheet primitive before building a new one; use it if present for visual consistency).
2. When open for a given `clientId`, it must render **the exact same field set** the existing `QuestionEditor.tsx` renders for that question's `type` (prompt, options, correct answers, accepted variants, word limit, points — all type-specific branches already implemented via `kindOf(type)`). The cleanest approach: refactor `QuestionEditor.tsx` minimally so its internal field-rendering logic can be invoked as a reusable function/sub-component that both the existing vertical list AND this new drawer can call, rather than copy-pasting its ~700 lines. Read the whole file first and make the smallest change that achieves this reuse (e.g., extract the current top-level render body into an exported `QuestionFieldSet` component that both `QuestionEditor` and your new drawer wrap, or have the drawer literally render `<QuestionEditor>` in a compact layout mode via a new optional `variant="drawer"` prop — pick whichever requires the least structural change and causes zero behavior change to the existing vertical-list usage).
3. Add a live "excerpt" line at the top of the drawer showing the surrounding pasted text near this node's position in the document (e.g., 40 characters before + after), so the teacher has context for what they're configuring without needing to scroll back to find the chip in the passage — compute this by walking the TipTap document JSON to find the node's position and slicing nearby text nodes.
4. Changes in the drawer update the `clientId → BuilderQuestion` state map in `VisualQuestionCanvas.tsx` immediately (controlled, not on a separate "apply" step) — matches the existing app's autosave-forward feel described in `TESTS_AND_MOCKS.md` for the runner (though this is authoring, not taking, keep interactions equally responsive).
5. Verify: opening the drawer for a `multiple_choice` node shows options + correct-answer fields; for `essay_task2` shows only prompt/points (no options); for `matching_headings` shows the options+variants fields — matching `QuestionEditor.tsx`'s existing branching exactly, with no regressions to the existing usage of `QuestionEditor` elsewhere.

---

## TASK 4: Toolbar — one button per question type, insert-at-cursor, plus auto-numbering

**File:** `frontend/src/components/exam-builder/visual-editor/QuestionTypeToolbar.tsx`

1. Sticky toolbar above the editor (`position: sticky; top: ...` matching the existing sticky offsets used in `ReadingPassageEditor.tsx` line ~681 for visual consistency — reuse the same `top-36` class or whatever the current sticky elements use, don't invent a new offset).
2. Render one button per allowed type for the current skill — filter `GROUPED_TYPES`' flattened type list through `TYPES_BY_SKILL[skill]` (from `exam-builder/types.ts`) so, e.g., a listening group's toolbar never offers `essay_task1`. Group the buttons visually by `GROUPED_TYPES`' groups ("Choice", "Fill in", "Match", "Write / Speak") with small group labels or a dropdown-per-group if 15 flat buttons is too wide — use your judgment on layout, but keep every legal type reachable in at most 2 clicks.
3. Clicking a button:
   - Inserts a new `questionNode` at the current cursor position (if there is a text selection, insert immediately after it, or replace the selection with the node and keep the selected text as the node's initial `prompt` value pre-filled — this second behavior is strongly preferred since it directly implements the user's "select text and turn it into a question" desire; implement it if feasible within TipTap's selection API, otherwise fall back to plain cursor insertion and note the limitation in your summary).
   - Creates a new default `BuilderQuestion` via the existing `newQuestion(number, type, auto)` helper (from `mock/exam-builder/types.ts`) — reuse it exactly as `GroupEditor.tsx`'s own `addQuestion()` does (see that function for the existing `number`/`auto` computation pattern), and adds it to the `clientId → BuilderQuestion` map.
   - Immediately opens the Settings Drawer for the new node so the teacher can fill it in without an extra click.
4. **Auto-numbering:** on every document change, walk the TipTap document in order, collect all `questionNode`s in the order they appear, and assign `number = 1, 2, 3, ...` (or continue from `nextQuestionNumber(detail.sections)` if this group isn't the exam's first, matching the existing cross-group numbering behavior in `GroupEditor.tsx`'s `addQuestion()` — the whole exam's questions must be numbered contiguously 1..40 across groups, not restarted per group). Update each chip's displayed number live. Do not let numbers be manually editable in the drawer — position in the document is the single source of truth for order/number, consistent with the user's "just place it where it goes" mental model.
5. Verify: inserting 5 different-typed nodes into pasted text produces 5 chips numbered 1–5 in document order; deleting the 2nd chip renumbers 3,4,5 down to 2,3,4 automatically; dragging a chip to a new position (Task 5) renumbers correctly.

---

## TASK 5: Drag-and-drop reordering of chips within the flowing text

1. TipTap/ProseMirror atomic inline nodes are draggable by default when `draggable: true` is set on the node spec and the NodeView sets `dragHandle`/appropriate DOM attributes. Enable this on `questionNode`.
2. Confirm dragging a chip to a different position in the text correctly moves it in the document (ProseMirror handles this natively for atom nodes) and triggers the renumbering logic from Task 4.
3. Add a visual drop-indicator (a thin highlighted line) while dragging, if not provided by default — check ProseMirror's `dropCursor` extension (`@tiptap/extension-dropcursor`, install if not already a transitive dependency) and enable it.
4. Verify with a manual drag test: drag chip #3 to before chip #1, confirm it becomes #1 and the rest shift down.

---

## TASK 6: Serialize the document into `BuilderPart` shape and wire Save to existing mutations

**File:** integrate inside `VisualQuestionCanvas.tsx`, called from `GroupEditor.tsx`

1. Write a pure function `serializeVisualDocument(doc: JSONContent, questionMap: Record<string, BuilderQuestion>): { passageText: string; questions: BuilderQuestion[] }`:
   - Walk the TipTap JSON document. Concatenate all plain-text runs (paragraph text, preserving line breaks as `\n`) into `passageText`, in order.
   - For each `questionNode` encountered, look up its full `BuilderQuestion` from `questionMap` by `clientId`, and set its `number` per the Task 4 auto-numbering pass. Collect these into the `questions` array, in document order.
   - Decide, and document your choice clearly in a code comment: whether the question-node's position within the passage text should also be preserved as an inline marker (e.g., leave a placeholder token like `[[Q3]]` in `passageText` at the exact spot) so students later see the question inline within the passage — versus stripping it out entirely and just using position-derived ordering with `passageText` as flowing prose and questions listed separately below it (matching how the reading runner currently renders passage + questions per `TESTS_AND_MOCKS.md` §6 `AttemptView`/`test-runner.tsx`). Check how existing `MockGroup.passageText` + `questions[]` are rendered together in the student-facing runner (`frontend/src/components/mock/mock-runner.tsx` or equivalent) before deciding, and match that existing rendering contract — do not invent a new student-facing format without checking backward compatibility with how the runner already displays a group's passage + its questions.
2. Wire a "Create" / "Save" action in `GroupEditor.tsx` (when Visual paste mode is active) that calls `serializeVisualDocument()` then reuses the **exact same** `updateGroup` / `addQuestions` / `updateQuestion` / `deleteQuestion` mutation calls already present in `GroupEditor.tsx`'s existing `save()` function — do not create a new backend-calling path. If a question already has a `savedQuestionId` (i.e., it was loaded from an existing group and is being re-edited in visual mode), call `updateQuestion`; otherwise `addQuestions` (batch, respecting the backend's 1–60 batch limit — if a single group ever exceeds 60 questions, chunk the batch calls).
3. Before saving, run `validatePart(skill, part)` (existing function) against the serialized result and block save with the same error-list UI pattern already used in `GroupEditor.tsx` (`errors` state + the red banner) if validation fails — do not build a separate validation/error-display mechanism.
4. Wire the existing `dirty` / `onDirty` tracking (`GroupEditor.tsx` already computes `dirty` by diffing `part` vs `snapshot` and calls `onDirty(dirty)`) so switching away from Visual paste mode with unsaved changes triggers the same "unsaved changes" warning the rest of the builder already has (check how `ExamBuilder.tsx`/`Sidebar.tsx` currently use `onDirty` for navigation guards, and hook into the same mechanism — do not build a parallel warning system).

---

## TASK 7: Mode toggle inside `GroupEditor.tsx` — add, don't replace

1. Add a small segmented control / tab switch at the top of the question-authoring area in `GroupEditor.tsx`: **"Form list"** (existing behavior, unchanged) | **"Visual paste"** (new, from this task) | keep the existing **"Import"** (`ImportPanel.tsx`) as a third option if it isn't already a separate entry point — check current UI to see how `ImportPanel` is currently surfaced and keep it reachable without regression.
2. Switching modes must not lose data: if a teacher builds questions in Visual paste mode, switching to Form list must show the same questions (converted from the `clientId → BuilderQuestion` map into the existing `BuilderPart.questions` array) and vice versa — both modes read/write the same underlying `part` state in `GroupEditor.tsx`, they are just two different views over it. Do not maintain two disconnected sources of truth.
3. Persist the user's last-chosen mode per browser (e.g., `localStorage` key `examBuilder.questionMode`) so it doesn't reset every time they open a group — check the repo's `CRITICAL BROWSER STORAGE RESTRICTION` guidance if this code path is ever used inside an artifact context (it isn't; this is the main Next.js app, not a claude.ai artifact, so plain `localStorage` is fine here — this restriction only applies to claude.ai-rendered artifacts, not to this production Next.js codebase).
4. Verify: build a group entirely in Visual paste mode, switch to Form list, confirm identical question count/content/order; edit one question's correct answer in Form list, switch back to Visual paste, confirm the chip's drawer reflects the edit.

---

## TASK 8: Live "preview as student" toggle

1. Reuse `StudentPreview.tsx` as-is. Add a toggle button in the Visual paste mode toolbar that swaps the canvas for the existing student preview rendering of the current, in-progress (unsaved) `part` state — so the teacher can see exactly what a student would see without leaving the editor or saving first. If `StudentPreview.tsx` currently only reads already-saved server data rather than in-memory draft state, extend it (or wrap it) to also accept an in-memory `BuilderPart` as an optional prop, matching however `PreviewDialog.tsx` already handles previewing unsaved drafts elsewhere in the builder (check that file for the existing pattern before adding a new one).

---

## TASK 9: i18n

1. Add new translation keys for: toolbar button labels (can mostly reuse `QTYPE_LABEL` values you already have, but the toolbar's short button text may need shorter forms — e.g. "MCQ" vs full "Multiple choice"), the drawer's section headers, the mode-toggle labels ("Form list" / "Visual paste"), and the placeholder text from Task 1.
2. Add these to all three locale files: `frontend/messages/en.json`, `frontend/messages/ru.json`, `frontend/messages/uz.json` — follow the existing `examBuilder` namespace structure already used by sibling components (check how `ReadingPassageEditor.tsx` and `GroupEditor.tsx` call `tx(t, "key", "fallback")` and add matching keys under the same namespace, not a new one).
3. Verify no missing-translation console warnings appear when switching locale while the new mode is active.

---

## TASK 10: Edge cases, guardrails, and tests

Handle and verify each of these explicitly:
1. Pasting extremely large text (e.g., >20,000 characters) — reuse whatever existing character-limit UX the app already applies to `passageText` (check `passageText?≤20000` constraint mentioned for mock groups in `TESTS_AND_MOCKS.md` §4.1) and surface the same limit/warning in the Visual paste editor.
2. Pasting from Word/Google Docs with embedded images — images should be stripped from the pasted content (this canvas is for text + question nodes only; image/diagram upload stays on the existing dedicated `media` upload flow in `GroupEditor.tsx`, do not conflate the two).
3. Undo/redo (`Ctrl+Z`/`Ctrl+Y`) must correctly restore/remove `questionNode`s along with surrounding text edits, and must keep the `clientId → BuilderQuestion` map in sync (removing a node via undo should not leave an orphaned entry in the map forever — garbage-collect entries whose `clientId` no longer appears in the document, but only after a short debounce so mid-drag/mid-undo states don't cause flicker-deletes).
4. Deleting a node whose drawer is currently open must close the drawer gracefully (no dangling reference / crash).
5. Empty document (no text pasted yet, or all text and nodes deleted) — "Save" should behave exactly as it does today for an empty group (whatever `validatePart` currently reports for zero questions — do not change that existing rule).
6. Write at least a handful of unit tests for `serializeVisualDocument()` (pure function, easy to test in isolation) covering: text-only document (no nodes), single node with surrounding text, multiple nodes with text between/around them, and a node with no surrounding text at all. Put these in `frontend/src/components/exam-builder/visual-editor/__tests__/serialize.spec.ts` (or match the existing test file convention/location if the project uses a different pattern — check for existing `.spec.ts`/`.test.ts` files anywhere in `frontend/src` first).

---

## Acceptance Criteria (must all be true before you consider this done)

- [ ] `npm run build` and `npx tsc --noEmit` pass in `frontend/` with the new dependency and all new files.
- [ ] A teacher can paste raw text into the right-hand panel of a reading passage group or a listening part group.
- [ ] A sticky toolbar shows one button per question type legal for that skill (filtered via `TYPES_BY_SKILL`), grouped sensibly.
- [ ] Clicking a toolbar button inserts an inline, numbered chip exactly at the cursor/selection position without corrupting surrounding text.
- [ ] Clicking a chip opens a settings drawer with the exact same fields `QuestionEditor.tsx` already renders for that type — no duplicated/diverging field logic.
- [ ] Questions are auto-numbered by document order, contiguous with the rest of the exam's numbering, and renumber live on insert/delete/drag-reorder.
- [ ] Chips can be dragged to reorder within the text.
- [ ] Saving in Visual paste mode calls the exact same existing mutations (`useAddMockQuestions`/`useUpdateMockQuestion`/`useDeleteMockQuestion`/`useUpdateMockGroup`) as the existing Form list mode — no new backend endpoints were added unless Task 6.1's investigation genuinely required a passage-marker format change, in which case that change is called out explicitly in the final summary with backward-compatibility impact on the student runner noted.
- [ ] Switching between "Form list" and "Visual paste" modes preserves all question data losslessly in both directions.
- [ ] The existing "Form list" and "Import" modes are functionally unchanged — no regressions.
- [ ] `StudentPreview` works from unsaved, in-memory Visual paste draft state.
- [ ] New i18n keys exist in `en.json`, `ru.json`, `uz.json` under the existing `examBuilder` namespace.
- [ ] Unit tests for `serializeVisualDocument()` exist and pass.
- [ ] A final changelog listing every file created/changed and why is provided at the end, plus an explicit note of any design decision you had to make where this spec left room for judgment (e.g., the passage-marker-token decision in Task 6.1).

Work through the tasks strictly in order (1 → 10). Do not declare the job finished until every checkbox above is genuinely satisfied. This is a large feature — take the time to read every referenced existing file in full before writing new code, so the new mode feels like a native part of this codebase rather than a bolted-on library demo.
