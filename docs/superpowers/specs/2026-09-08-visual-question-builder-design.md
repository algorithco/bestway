# Visual Paste & Place Question Builder — Design Spec

Date: 2026-09-08
Status: Approved design (brainstorming architectural path), pending spec review → writing-plans
Source intent: `bestway-visual-question-builder-prompt.md` (157 lines, Tasks 1–10 + Acceptance Criteria)
Decisions locked in brainstorming: mount in **all three editors** (Reading + Listening + generic Group), extract **`QuestionFieldSet`**, add **vitest** to frontend.

## 1. Context & Goals

Build a new authoring mode — "Visual paste mode" — inside the question-authoring area, alongside Form list and ImportPanel paste-and-parse. Teacher pastes plain text (Word/PDF/book) into right-hand panel, clicks exact spot, presses toolbar button (e.g. "Add multiple choice"), inline atomic widget (chip/node, n8n-like) is inserted without disturbing surrounding text. Clicking chip opens settings drawer (options, correct answer, points). Fast, visual, place-then-configure vs fixed vertical form list.

Stack: Next.js 16 / React 19 / Tailwind v4 / TanStack Query in `frontend/src`; NestJS in `backend/src`. Use TipTap (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`) — no hand-rolled contentEditable.

Must reuse, not duplicate:
- `ReadingPassageEditor.tsx` — two-column `xl:grid-cols-[minmax(0,11fr)_minmax(0,13fr)]`, passage sticky left. Reading entry point.
- `ListeningPartEditor.tsx` + `ListeningAudioCard.tsx` — audio-owns-part pattern.
- `GroupEditor.tsx:137-224` `save()` — 5-step sync via `useAddMockQuestions` / `useUpdateMockQuestion` / `useDeleteMockQuestion` / `useUpdateMockGroup` from `frontend/src/hooks/use-mock.ts`.
- `mock/exam-builder/QuestionEditor.tsx` (1358 lines, `kindOf(type)` branches for all 15 types) — reuse field logic in drawer.
- `mock/exam-builder/types.ts` — `BuilderQuestion`, `BuilderPart`, `GROUPED_TYPES`, `QTYPE_LABEL`, `newQuestion()`, `validatePart()`, `isAutoType()`, `uid()`.
- `exam-builder/types.ts` — `TYPES_BY_SKILL`, `SKILL_META`, `nextQuestionNumber()`, `tx()`.
- `StudentPreview.tsx` (`{group, skill}` pure/in-memory, already fed unsaved drafts) — reuse for preview toggle.
- `lib/gap-fill.ts` — paste/segment precedent (`GAP_RE`, `parseGapText`, `numberGaps`, `buildGapQuestions`).
- Backend `POST /mock/groups/:groupId/questions {questions[1..60]}` — no new endpoints.

## 2. Architecture

New package `frontend/src/components/exam-builder/visual-editor/`:

- `VisualQuestionCanvas.tsx` — owns `useEditor()` (StarterKit with headings/blockquote/codeBlock disabled + `Placeholder` "Paste question text here…" + `DropCursor`) + React state `Record<clientId, BuilderQuestion>`. Owns renumber walk, excerpt computation, `serializeVisualDocument()`, dirty propagation.
- `question-node-extension.tsx` — TipTap `Node` named `questionNode`: `group:inline, inline:true, atom:true, draggable:true`. Attrs only `clientId: string` + `questionType: MockQuestionType`. Question data lives in React map, not TipTap attrs (small doc, single canonical store).
- `QuestionChip.tsx` — `ReactNodeViewRenderer`: colored badge by `GROUPED_TYPES` (Choice=blue, Fill=green, Match=purple, Write/Speak=orange), live number, `QTYPE_LABEL[type]`, red incomplete dot via extracted `validateOneQuestion()`, click → open drawer, hover × → delete node + map entry. `role=button`, `aria-label` "{type} {number} {complete/incomplete}", `aria-expanded`, keyboard navigable. Matches `ReadingPassageEditor.tsx` aria house style.
- `QuestionTypeToolbar.tsx` — sticky `top-36` (match `ReadingPassageEditor.tsx:678-682`), grouped by `GROUPED_TYPES` groups with labels / dropdown-per-group if >width. Filtered by `TYPES_BY_SKILL[skill]` so listening never offers essays. ≤2 clicks to any legal type.
- `QuestionSettingsDrawer.tsx` — Radix `Dialog` right-docked (`ml-auto h-full max-w-xl`, precedent `PreviewDialog.tsx:55` `max-w-4xl max-h-[92vh]`), renders extracted `QuestionFieldSet` + 40-char excerpt (walk TipTap JSON to node pos, slice nearby text). Controlled updates to map immediately, no Apply step.
- `serialize.ts` — pure `serializeVisualDocument(doc: JSONContent, map): {passageText: string; questions: BuilderQuestion[]}`. Concatenate text runs with `\n`, collect nodes in doc order, assign numbers. **Stripped prose decision:** strip markers entirely; `passageText` = clean prose. Rationale: runner `mock-runner.tsx:421-439` renders `passageText` verbatim `whitespace-pre-line` + separate `questions.map(<QuestionInput/>)`; grep `[[Q` = 0 hits. Saving `[[Q3]]` tokens would render literally to students. No new student format without runner parser change (out of scope).
- `__tests__/serialize.spec.ts` — vitest (new to frontend).

Mount points (all three editors per user decision): `GroupEditor.tsx` (generic fallback), `ReadingPassageEditor.tsx`, `ListeningPartEditor.tsx`. Each gets segmented control Form list | Visual paste | Import (keep `ImportPanel` reachable via existing `showImport` toggle pattern). Both modes read/write same `part` state in host editor — two views, one truth. Persist `localStorage examBuilder.questionMode` (plain localStorage fine — production Next.js app, not claude.ai artifact; no CRITICAL restriction in repo).

## 3. Data Flow & Numbering

1. Toolbar click → `editor.chain().focus().insertContent({type:questionNode, attrs:{clientId, questionType}}).run()` at cursor; if text selection, replace selection and pre-fill `prompt` with selected text (preferred; fallback to cursor insert with limitation noted).
2. Create default via `newQuestion(number, type, isAuto)` exactly as host `addQuestion()` does; add to map; open drawer.
3. On every doc change: walk doc in order, collect `questionNode`s, assign `number = base+1..` where `base = nextQuestionNumber(detail.sections)-1` merged with local max (match `GroupEditor.tsx:240-242` formula). Numbers not manually editable — position is truth. Live chip update; delete/drag triggers renumber (e.g. delete #2 → 3,4,5 become 2,3,4).
4. Drag: `draggable:true` + `@tiptap/extension-dropcursor` indicator; ProseMirror moves atom natively.
5. Save: `serializeVisualDocument()` → `validatePart(skill, part)` + `duplicateNumberErrors` → existing red-banner `errors` UI (`role=alert`) → same 5-step mutations (PATCH group `{passageText ≤20000}`, delete-removed loop, PATCH existing with `sortOrder`, POST fresh chunked ≤60) → `setSnapshot(deepClone)` + media `FormData` only on save. Dirty = `JSON.stringify(part)!==snapshot` → `onDirty` → `ExamBuilder.tsx` `registerSave`/`beforeunload`/Dialog guards. No parallel warning system.
6. Mode switch: map ↔ `BuilderPart.questions` conversion both directions, lossless; edit in Form list reflects in chip drawer and vice versa.
7. Preview toggle: build `previewGroup(part, {hasAudio:false, imageUrl:null})` from unsaved draft, pass stable `id:visual-paste-draft` to `StudentPreview`. Extend `StudentPreview` with optional `audioSrc?/imageSrc?` props (fallback to current `/api/backend/mock/groups/${id}/audio|image`) — no change to `mock-runner.tsx`.

## 4. QuestionEditor Reuse (approved: extract)

`QuestionEditor.tsx` monolith (1358 lines): props `{question, skill, allowedTypes, onChange, onRemove}`, `kind=kindOf(type)` → 11 kinds (`choice-single/multi`, `tfng`, `ynng`, `matching`, `headings`, `completion`, `short`, `map`, `essay`, `speaking`), sets `OPTION_TYPE_SET`, `WORD_LIMIT_SET`, `VARIANTS_SET`, helpers `OptionRow/ChipsEditor/WordLimitControl/QuestionPreview`, `describeTypeLoss/buildSwitchedQuestion`, `getQuestionFieldErrors`.

Plan: extract inner form `828-1347` to exported `QuestionFieldSet({question, skill, allowedTypes, onChange})`; keep `QuestionEditor = <card><header+delete/><QuestionFieldSet/><Preview/></card>` unchanged behaviorally. Drawer renders `<QuestionFieldSet/>` in fragment (no card chrome). IDs already `qe-${clientId}-*` so multi-instance safe. Factor `validateOneQuestion(q): string[]` from `validatePart` without changing existing callers. Verify: MCQ shows options+key; essay_task2 prompt/points only; matching_headings options+variants — zero regression to vertical list.

## 5. Paste, i18n, Edge Cases

- Paste: `editorProps.transformPastedHTML`/`handlePaste` → strip bold/color/fonts/images, preserve `\n`/paragraphs. Images stripped (media stays on dedicated upload flow). 20k `passageText` limit surfaced same as existing (`CreateGroupDto/UpdateGroupDto ≤20000`, readiness gate `reading_passage: fail` blocks publish).
- Undo/redo (Ctrl+Z/Y) restores nodes + text; GC orphan map entries debounced (avoid mid-drag flicker). Deleting node with open drawer closes gracefully. Empty doc → `validatePart` zero-questions rule unchanged.
- i18n: add keys under `examBuilder` in `frontend/messages/en|ru|uz.json` (actual path sibling of `src/`): `visualPaste`, `visualPasteHint`, `pasteBlock`, toolbar shorts (e.g. MCQ), drawer headers, mode labels, placeholder. Use `tx(t,key,fallback)` so missing keys fall back.
- Tests: add `vitest` + `frontend/vitest.config.ts` + `test` script (frontend currently zero `*.spec.*`, no runner; backend uses zero-config vitest). Cover serialize: text-only, single node + surrounding text, multi-node, bare node.

## 6. Acceptance Mapping (from source spec)

- `npm run build` + `npx tsc --noEmit` pass with new deps + files.
- Paste raw text in reading/listening groups; sticky toolbar per-skill filtered, grouped.
- Insert chip at cursor/selection without corruption; typing/paste around it safe.
- Chip click → drawer with identical fields to `QuestionEditor` for that type.
- Auto-number doc-order, exam-contiguous, live on insert/delete/drag; drag reorder works.
- Save uses same mutations, no new endpoints (unless Task 6.1 marker investigation required change — it did not; stripped prose chosen, runner-compatible).
- Mode switch lossless both ways; Form list + Import unchanged.
- `StudentPreview` from unsaved draft; i18n keys in 3 locales; serialize unit tests pass.
- Final changelog + judgment notes (marker decision, toolbar layout, selection→prompt fallback if any).

## 7. Risks & Notes

- Stale spec refs: `GroupEditor.tsx`-only integration predates refactor `137df99`; fixed by mounting in all three editors.
- i18n path in spec (`frontend/messages/…`) actually `frontend/messages/` sibling of `src/` — verified.
- `@tiptap/extension-dropcursor` needs fresh install (not transitive); all `@tiptap/*` absent.
- `QuestionEditor` refactor touches hot file — keep diff minimal, verify existing vertical list + `PreviewDialog` untouched.
- Next 16 (`frontend/AGENTS.md` breaking-changes warning) — verify `useEditor` SSR safety (`immediatelyRender:false` if needed).
- Judgment room left: toolbar flat vs dropdown-per-group (implementer picks by width, ≤2 clicks); excerpt length 40 chars each side; GC debounce ~500ms.

## 8. Out of Scope

New backend endpoints, runner inline-marker rendering, image/diagram canvas support, rich-text formatting preservation, legacy dialog restoration, auth/storage changes.
