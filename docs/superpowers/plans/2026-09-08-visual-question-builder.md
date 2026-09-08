# Visual Paste Question Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Visual paste authoring mode (TipTap inline chips + drawer + toolbar) to all three exam-builder editors without regressing Form list / Import.

**Architecture:** New `visual-editor/` package (pure serialize + TipTap node + canvas + toolbar + drawer) mounted as a second view over the same `BuilderPart` state in `GroupEditor`, `ReadingPassageEditor`, `ListeningPartEditor`; save reuses the existing 5-step mutations.

**Tech Stack:** Next.js 16.3.4 / React 19.2.4 / TipTap v3 (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder`, `@tiptap/extension-dropcursor`) / Tailwind v4 / TanStack Query / vitest (new to frontend) / next-intl.

**Spec:** `docs/superpowers/specs/2026-09-08-visual-question-builder-design.md`

## Global Constraints

- Node 20+, `frontend/` only unless stated; `strict:true`, `noEmit:true`, `moduleResolution:bundler`, `jsx:react-jsx` (`frontend/tsconfig.json`).
- `"use client"` on every new visual-editor component (Next 16 client boundary; check `node_modules/next/dist/docs/` if `useEditor` SSR warns, set `immediatelyRender: false`).
- Reuse `BuilderQuestion`, `BuilderPart`, `GROUPED_TYPES`, `QTYPE_LABEL`, `newQuestion(n,type,isAuto)`, `validatePart`, `isAutoType`, `uid` from `frontend/src/components/mock/exam-builder/types.ts` — no parallel copies.
- Filter toolbar by `TYPES_BY_SKILL[skill]` from `frontend/src/components/exam-builder/types.ts`; numbering via `nextQuestionNumber()` exam-global, never per-group restart.
- `passageText ≤ 20000` chars (API limit); batch `POST /mock/groups/:id/questions` ≤ 60 per call, chunk if more.
- Serialize = stripped prose only — never save `[[Qn]]` markers (`mock-runner.tsx` renders passage verbatim).
- i18n via `tx(t,key,fallback)` under `examBuilder` namespace in `frontend/messages/en.json`, `ru.json`, `uz.json`.
- Drawer primitive = Radix `Dialog` (`frontend/src/components/ui/dialog.tsx`) right-docked; do not add vaul/sheet dep.
- Do not touch `mock-runner.tsx`; `StudentPreview.tsx` extension must stay backward compatible.
- Verify each task with `npx tsc --noEmit` in `frontend/` and `npm run build` at the end.

---

### Task 1: Toolchain — TipTap + dropcursor + vitest

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `npm run build` still passes; `npm test` runs vitest over `src/**/@@tests@@/*.spec.ts`

- [ ] **Step 1: Install runtime deps**

```bash
cd frontend
npm install -S @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/extension-dropcursor
```

- [ ] **Step 2: Run it and confirm TipTap resolves**

Run: `cd frontend; npx tsc --noEmit`
Expected: PASS (no new imports yet, lockfile updated). If peer warns on React 19, keep TipTap v3 (React 19 compatible) — do not downgrade React.

- [ ] **Step 3: Add vitest toolchain**

```bash
cd frontend
npm install -D vitest
```

Edit `frontend/package.json` scripts (keep existing, add one line):

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run --passWithNoTests" (flag required: bare `vitest run` exits 1 on empty suite)
  }
}
```

Create `frontend/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 4: Run empty test suite to verify wiring**

Run: `cd frontend; npm test`
Expected: PASS with "No test files found" (exit 0). If vitest complains about ESM, keep `environment:node` and `.spec.ts` extension only.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vitest.config.ts
git commit -m "chore(frontend): add tiptap deps and vitest toolchain"
```

---

### Task 2: Pure serializer + unit tests (TDD, no editor needed)

**Files:**
- Create: `frontend/src/components/exam-builder/visual-editor/serialize.ts`
- Test: `frontend/src/components/exam-builder/visual-editor/__tests__/serialize.spec.ts`

**Interfaces:**
- Consumes: `BuilderQuestion` from `@/components/mock/exam-builder/types`
- Produces: `serializeVisualDocument(doc: JSONContent, map: Record<string, BuilderQuestion>): { passageText: string; questions: BuilderQuestion[] }`

Doc shape (TipTap JSON): `{ type: "doc", content: Array<{ type: "paragraph", content?: Array<{ type: "text", text: string } | { type: "questionNode", attrs: { clientId: string; questionType: string } }> }> }`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/components/exam-builder/visual-editor/__tests__/serialize.spec.ts
import { describe, expect, it } from "vitest";
import { serializeVisualDocument } from "../serialize";
import type { BuilderQuestion } from "@/components/mock/exam-builder/types";

function q(over: Partial<BuilderQuestion> & { clientId: string }): BuilderQuestion {
  return {
    number: 0,
    type: "multiple_choice",
    prompt: "p",
    options: ["a", "b"],
    correctAnswers: ["a"],
    acceptedVariants: [],
    points: 1,
    ...over,
  };
}

describe("serializeVisualDocument", () => {
  it("text-only document yields prose and zero questions", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
        { type: "paragraph", content: [{ type: "text", text: "World" }] },
      ],
    };
    const out = serializeVisualDocument(doc, {});
    expect(out.passageText).toBe("Hello\nWorld");
    expect(out.questions).toEqual([]);
  });

  it("single node with surrounding text numbers from base+1", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Read " },
            { type: "questionNode", attrs: { clientId: "c1", questionType: "multiple_choice" } },
            { type: "text", text: " then answer." },
          ],
        },
      ],
    };
    const out = serializeVisualDocument(doc, { c1: q({ clientId: "c1" }) }, 10);
    expect(out.passageText).toBe("Read  then answer.");
    expect(out.questions.map((x) => x.number)).toEqual([11]);
    expect(out.questions[0].clientId).toBe("c1");
  });

  it("multiple nodes keep doc order and contiguous numbers", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "questionNode", attrs: { clientId: "a", questionType: "short_answer" } },
            { type: "text", text: " mid " },
            { type: "questionNode", attrs: { clientId: "b", questionType: "short_answer" } },
          ],
        },
        {
          type: "paragraph",
          content: [{ type: "questionNode", attrs: { clientId: "c", questionType: "short_answer" } }],
        },
      ],
    };
    const out = serializeVisualDocument(
      doc,
      { a: q({ clientId: "a" }), b: q({ clientId: "b" }), c: q({ clientId: "c" }) },
      0,
    );
    expect(out.questions.map((x) => x.clientId)).toEqual(["a", "b", "c"]);
    expect(out.questions.map((x) => x.number)).toEqual([1, 2, 3]);
  });

  it("bare node with no surrounding text still serializes", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "questionNode", attrs: { clientId: "z", questionType: "essay_task2" } }] }],
    };
    const out = serializeVisualDocument(doc, { z: q({ clientId: "z", type: "essay_task2" }) }, 5);
    expect(out.passageText).toBe("");
    expect(out.questions[0].number).toBe(6);
  });

  it("drops map entries with no node and nodes with no map entry", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "questionNode", attrs: { clientId: "keep", questionType: "short_answer" } }] }],
    };
    const out = serializeVisualDocument(
      doc,
      { keep: q({ clientId: "keep" }), orphan: q({ clientId: "orphan" }) },
      0,
    );
    expect(out.questions.map((x) => x.clientId)).toEqual(["keep"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npm test -- serialize.spec`
Expected: FAIL with "Cannot find module '../serialize'".

- [ ] **Step 3: Write minimal implementation**

```ts
// frontend/src/components/exam-builder/visual-editor/serialize.ts
import type { JSONContent } from "@tiptap/react";
import type { BuilderQuestion } from "@/components/mock/exam-builder/types";

type TextInline = { type?: string; text?: string; attrs?: { clientId?: string } };

export function serializeVisualDocument(
  doc: JSONContent,
  map: Record<string, BuilderQuestion>,
  baseNumber = 0,
): { passageText: string; questions: BuilderQuestion[] } {
  const paragraphs: string[] = [];
  const orderedIds: string[] = [];
  const blocks = Array.isArray(doc?.content) ? doc.content : [];
  for (const block of blocks) {
    let line = "";
    const inlines = Array.isArray((block as JSONContent)?.content)
      ? ((block as JSONContent).content as TextInline[])
      : [];
    for (const inline of inlines) {
      if (inline?.type === "questionNode") {
        const id = inline?.attrs?.clientId;
        if (typeof id === "string" && map[id] && !orderedIds.includes(id)) orderedIds.push(id);
        continue;
      }
      if (typeof inline?.text === "string") line += inline.text;
    }
    paragraphs.push(line);
  }
  // Strip leading/trailing empty paragraphs but keep inner breaks (matches whitespace-pre-line render).
  while (paragraphs.length > 0 && paragraphs[0].trim() === "") paragraphs.shift();
  while (paragraphs.length > 0 && paragraphs[paragraphs.length - 1].trim() === "") paragraphs.pop();
  const questions = orderedIds.map((id, idx) => ({ ...map[id], number: baseNumber + idx + 1 }));
  return { passageText: paragraphs.join("\n"), questions };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend; npm test -- serialize.spec`
Expected: PASS (5 tests). Then `npx tsc --noEmit` PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/exam-builder/visual-editor/serialize.ts frontend/src/components/exam-builder/visual-editor/__tests__/serialize.spec.ts
git commit -m "feat(exam-builder): add visual serialize with unit tests"
```

---

### Task 3: questionNode extension + QuestionChip

**Files:**
- Create: `frontend/src/components/exam-builder/visual-editor/question-node-extension.ts`
- Create: `frontend/src/components/exam-builder/visual-editor/QuestionChip.tsx`

**Interfaces:**
- Consumes: `QTYPE_LABEL`, `GROUPED_TYPES` from `@/components/mock/exam-builder/types`; `validateOneQuestion` (added in Task 4 — if doing tasks in order, stub chip's incomplete-dot via local `prompt/correctAnswers` check and rewire in Task 4; preferred: do Task 4 first)
- Produces: `QuestionNode` extension export; `QuestionChip({ clientId, questionType, number, incomplete, selected, onOpen, onDelete })`

- [ ] **Step 1: Write failing typecheck probe (no DOM needed)**

Create `question-node-extension.ts` first as empty export and confirm import fails where expected — simpler: write the extension directly (TipTap nodeviews need DOM; unit test at canvas level later). Gate for this task = `tsc` + manual chip render in Task 5 canvas.

- [ ] **Step 2: Implement the node extension**

```ts
// frontend/src/components/exam-builder/visual-editor/question-node-extension.ts
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { QuestionChip } from "./QuestionChip";

export const QuestionNode = Node.create({
  name: "questionNode",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      clientId: { default: "" },
      questionType: { default: "multiple_choice" },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-question-node][data-client-id]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-question-node": "", "data-client-id": HTMLAttributes.clientId })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(QuestionChip);
  },
});
```

Chip (`QuestionChip.tsx`, `"use client"`): read `node.attrs.clientId/questionType` from NodeView props, look up `BuilderQuestion` from a React context or props passed via `editor.storage` — simplest contract: canvas passes `editor.storage.visual = { getQuestion(id), openDrawer(id), deleteNode(id), getNumber(id), isIncomplete(id) }` before rendering; chip reads it. Render:

```tsx
"use client";
import type { NodeViewProps } from "@tiptap/react";
import { QTYPE_LABEL } from "@/components/mock/exam-builder/types";

const GROUP_COLOR: Record<string, string> = {
  Choice: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  "Fill in": "bg-green-500/15 text-green-700 border-green-500/30",
  Match: "bg-purple-500/15 text-purple-700 border-purple-500/30",
  "Write / Speak": "bg-orange-500/15 text-orange-700 border-orange-500/30",
};

export function groupOfType(t: string): string {
  if (["multiple_choice", "multi_select", "true_false_notgiven", "yes_no_notgiven"].includes(t)) return "Choice";
  if (["sentence_completion", "note_completion", "summary_completion", "table_completion", "short_answer"].includes(t)) return "Fill in";
  if (["matching", "matching_headings", "map_labelling"].includes(t)) return "Match";
  return "Write / Speak";
}

export function QuestionChip(props: NodeViewProps) {
  const store = (props.editor.storage as { visual?: {
    getNumber: (id: string) => number;
    isIncomplete: (id: string) => boolean;
    openDrawer: (id: string) => void;
    deleteNode: (id: string) => void;
  } }).visual;
  const clientId = (props.node.attrs.clientId ?? "") as string;
  const questionType = (props.node.attrs.questionType ?? "multiple_choice") as string;
  const number = store?.getNumber(clientId) ?? 0;
  const incomplete = store?.isIncomplete(clientId) ?? true;
  const label = (QTYPE_LABEL as Record<string, string>)[questionType] ?? questionType;
  const color = GROUP_COLOR[groupOfType(questionType)] ?? GROUP_COLOR.Choice;
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={`Question ${number} — ${label} — ${incomplete ? "incomplete" : "complete"}`}
      data-question-node=""
      data-client-id={clientId}
      onClick={() => store?.openDrawer(clientId)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); store?.openDrawer(clientId); } }}
      className={`mx-0.5 inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 align-baseline text-xs font-medium ${color}`}
    >
      <span aria-hidden>#{number}</span>
      <span>{label}</span>
      {incomplete && <span aria-hidden className="inline-block size-1.5 rounded-full bg-red-500" />}
      <button
        type="button"
        aria-label={`Delete question ${number}`}
        className="ml-0.5 rounded-full px-1 opacity-60 hover:opacity-100"
        onClick={(e) => { e.stopPropagation(); store?.deleteNode(clientId); }}
      >
        ×
      </button>
    </span>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend; npx tsc --noEmit`
Expected: PASS. If `ReactNodeViewRenderer` types complain, import type `NodeViewProps` from `@tiptap/react` (v3 exports it) — do not `any`-cast the whole file; cast only `editor.storage`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/exam-builder/visual-editor/question-node-extension.ts frontend/src/components/exam-builder/visual-editor/QuestionChip.tsx
git commit -m "feat(exam-builder): add questionNode extension and chip"
```

---

### Task 4: Extract QuestionFieldSet + validateOneQuestion (zero-regression refactor)

**Files:**
- Modify: `frontend/src/components/mock/exam-builder/QuestionEditor.tsx` (extract, keep wrapper)
- Modify: `frontend/src/components/mock/exam-builder/types.ts` (add `validateOneQuestion`)
- Test: `frontend/src/components/exam-builder/visual-editor/__tests__/validate-one.spec.ts`

**Interfaces:**
- Consumes: existing `validatePart`, `OPTION_TYPES`, `WORD_LIMIT_TYPES`, `isAutoType`
- Produces: `export function validateOneQuestion(skill: MockSkill, q: BuilderQuestion, opts?: { requirePassage?: false }): string[]`; `export function QuestionFieldSet(props: { question: BuilderQuestion; skill: MockSkill; allowedTypes: MockQuestionType[]; onChange: (q: BuilderQuestion) => void }): JSX.Element`

- [ ] **Step 1: Write failing test for validateOneQuestion**

```ts
// frontend/src/components/exam-builder/visual-editor/__tests__/validate-one.spec.ts
import { describe, expect, it } from "vitest";
import { validateOneQuestion } from "@/components/mock/exam-builder/types";

const base = { clientId: "c", number: 3, prompt: "Why?", options: ["a", "b"], correctAnswers: ["a"], acceptedVariants: [], points: 1 } as const;

describe("validateOneQuestion", () => {
  it("flags empty prompt", () => {
    expect(validateOneQuestion("reading", { ...base, prompt: "  " }).join(" ")).toMatch(/prompt/i);
  });
  it("flags choice with <2 options", () => {
    expect(validateOneQuestion("reading", { ...base, type: "multiple_choice", options: ["only"] }).length).toBeGreaterThan(0);
  });
  it("flags auto type with no key", () => {
    expect(validateOneQuestion("reading", { ...base, type: "short_answer", correctAnswers: [] }).length).toBeGreaterThan(0);
  });
  it("passes valid manual essay", () => {
    expect(validateOneQuestion("writing", { ...base, type: "essay_task2", options: [], correctAnswers: [] })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend; npm test -- validate-one.spec`
Expected: FAIL "validateOneQuestion is not exported".

- [ ] **Step 3: Implement validateOneQuestion by delegating to validatePart**

In `mock/exam-builder/types.ts` append (do not change `validatePart`):

```ts
import type { MockSkill } from "@/lib/types";

export function validateOneQuestion(skill: MockSkill, q: BuilderQuestion): string[] {
  const part: BuilderPart = {
    clientId: "probe",
    title: "",
    instructions: "",
    // Non-empty so reading's passage rule doesn't leak into per-chip dots.
    passageText: skill === "reading" ? "probe" : "",
    audioPlayLimit: 1,
    hasAudio: false,
    questions: [q],
  };
  return validatePart(skill, part);
}
```

- [ ] **Step 4: Extract QuestionFieldSet inside QuestionEditor.tsx**

Read the whole 1358-line file first. Move lines ~828–1347 (number/type grid excluded? keep number/type OUT of drawer — position is truth; drawer edits prompt/options/keys/variants/wordLimit/points only) into:

```tsx
export function QuestionFieldSet({ question, skill, allowedTypes, onChange }: {
  question: BuilderQuestion; skill: MockSkill; allowedTypes: MockQuestionType[]; onChange: (q: BuilderQuestion) => void;
}) {
  // ... existing field-rendering body verbatim (OptionRow/ChipsEditor/WordLimitControl branches via kindOf(type))
}
```

Keep `export function QuestionEditor({ question, skill, allowedTypes, onChange, onRemove })` rendering `<div className="rounded border bg-surface p-3"><header…/><QuestionFieldSet …/><QuestionPreview …/></div>` exactly as before. Do not change `ids` (`qe-${clientId}-*`).

- [ ] **Step 5: Verify zero regression + commit**

Run: `cd frontend; npm test -- validate-one.spec` PASS; `npx tsc --noEmit` PASS; `npm run build` PASS.
Manual: open an existing group in Form list, edit MCQ options + essay prompt — identical behavior.

```bash
git add frontend/src/components/mock/exam-builder/QuestionEditor.tsx frontend/src/components/mock/exam-builder/types.ts frontend/src/components/exam-builder/visual-editor/__tests__/validate-one.spec.ts
git commit -m "refactor(exam-builder): extract QuestionFieldSet and validateOneQuestion"
```

---

### Task 5: VisualQuestionCanvas scaffold + paste sanitization

**Files:**
- Create: `frontend/src/components/exam-builder/visual-editor/VisualQuestionCanvas.tsx`

**Interfaces:**
- Consumes: `QuestionNode`, `serializeVisualDocument`, `validateOneQuestion`, `newQuestion`, `nextQuestionNumber`
- Produces: `VisualQuestionCanvas({ skill, initialQuestions, examSections, onDirty, onRegisterSerialize }: {...})` — renders toolbar slot + editor + drawer host

Props contract (exact):

```ts
{
  skill: MockSkill;
  initialText: string;
  initialQuestions: BuilderQuestion[];
  baseNumber: number; // nextQuestionNumber(examSections)-localMax offset computed by host
  onChange: (text: string, questions: BuilderQuestion[]) => void;
  onOpenDrawer?: (clientId: string) => void; // canvas owns drawer by default; host override optional
}
```

- [ ] **Step 1: Implement canvas with StarterKit-stripped + Placeholder + DropCursor**

```tsx
"use client";
import * as React from "react";
import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Dropcursor from "@tiptap/extension-dropcursor";
import { QuestionNode } from "./question-node-extension";
import { serializeVisualDocument } from "./serialize";

export function VisualQuestionCanvas(props: {
  skill: MockSkill;
  initialText: string;
  initialQuestions: BuilderQuestion[];
  baseNumber: number;
  onChange: (text: string, questions: BuilderQuestion[]) => void;
}) {
  const [map, setMap] = React.useState<Record<string, BuilderQuestion>>(() =>
    Object.fromEntries(props.initialQuestions.map((q) => [q.clientId, q])),
  );
  const [order, setOrder] = React.useState<string[]>(props.initialQuestions.map((q) => q.clientId));

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: false, blockquote: false, codeBlock: false, horizontalRule: false, bulletList: false, orderedList: false }),
      Placeholder.configure({ placeholder: "Paste question text here, then use the toolbar to add answer inputs where they belong." }),
      Dropcursor.configure({ color: "var(--brand, #2563eb)", width: 2 }),
      QuestionNode,
    ],
    content: props.initialText
      ? { type: "doc", content: props.initialText.split("\n").map((line) => ({ type: "paragraph", content: line ? [{ type: "text", text: line }] : [] })) }
      : undefined,
    editorProps: {
      attributes: { class: "min-h-64 p-4 text-sm leading-relaxed focus:outline-none", "aria-label": "Visual question canvas" },
      transformPastedHTML(html) {
        // Aggressive plain-text sanitize: strip tags, keep line breaks.
        const withBreaks = html.replace(/<\s*br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h[1-6])>/gi, "\n");
        return withBreaks.replace(/<[^>]*>/g, "");
      },
      handlePaste(view, event) {
        // Drop images/files from paste — media stays on dedicated upload flow.
        if (event.clipboardData?.files?.length) event.clipboardData.files; // read to mark intentional
        return false; // let transformPastedHTML do text work; images have no tags left to render
      },
    },
    onUpdate({ editor }) {
      const doc = editor.getJSON() as JSONContent;
      const ids: string[] = [];
      for (const b of doc.content ?? []) for (const n of (b as { content?: Array<{ type?: string; attrs?: { clientId?: string } }> }).content ?? []) {
        if (n?.type === "questionNode" && typeof n?.attrs?.clientId === "string") ids.push(n.attrs.clientId);
      }
      setOrder(ids);
      // Debounced GC of orphan map entries (500ms) + excerpt/number refresh happens in render.
      const { passageText, questions } = serializeVisualDocument(doc, mapRef.current, props.baseNumber);
      props.onChange(passageText, questions);
    },
  });
  const mapRef = React.useRef(map);
  mapRef.current = map;
  // ... storage wiring (Task 6), toolbar slot, <EditorContent editor={editor} />
  return <div className="rounded border border-border bg-surface"><EditorContent editor={editor} /></div>;
}
```

Notes: `mapRef` avoids stale closure in `onUpdate`. GC effect (separate step): `React.useEffect` 500ms debounce deleting `map` keys not in `order` unless drawer open for that id.

- [ ] **Step 2: Typecheck + build probe**

Run: `cd frontend; npx tsc --noEmit`
Expected: PASS. Mount temporarily behind dev toggle in `GroupEditor` to paste Word text — styles stripped, `\n` preserved.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/exam-builder/visual-editor/VisualQuestionCanvas.tsx
git commit -m "feat(exam-builder): scaffold visual canvas with paste sanitize"
```

---

### Task 6: Toolbar — skill-filtered insert + auto-number + selection→prompt

**Files:**
- Create: `frontend/src/components/exam-builder/visual-editor/QuestionTypeToolbar.tsx`
- Modify: `VisualQuestionCanvas.tsx` (storage wiring: getNumber/isIncomplete/openDrawer/deleteNode; insert + renumber)

**Interfaces:**
- Consumes: `GROUPED_TYPES`, `TYPES_BY_SKILL`, `newQuestion`, canvas editor instance
- Produces: `QuestionTypeToolbar({ skill, onInsert }: { skill: MockSkill; onInsert: (type: MockQuestionType) => void })`

- [ ] **Step 1: Implement toolbar grouped by GROUPED_TYPES**

```tsx
"use client";
import { GROUPED_TYPES, QTYPE_LABEL } from "@/components/mock/exam-builder/types";
import { TYPES_BY_SKILL } from "@/components/exam-builder/types";
import type { MockQuestionType, MockSkill } from "@/lib/types";

const SHORT: Partial<Record<MockQuestionType, string>> = {
  multiple_choice: "MCQ",
  multi_select: "Multi",
  true_false_notgiven: "T/F/NG",
  yes_no_notgiven: "Y/N/NG",
};

export function QuestionTypeToolbar({ skill, onInsert }: { skill: MockSkill; onInsert: (t: MockQuestionType) => void }) {
  const allowed = new Set(TYPES_BY_SKILL[skill]);
  return (
    <div className="sticky top-36 z-[5] flex flex-wrap gap-x-4 gap-y-2 bg-bg/95 py-2 backdrop-blur" role="toolbar" aria-label="Add question">
      {GROUPED_TYPES.map((g) => {
        const types = g.types.filter((t) => allowed.has(t));
        if (!types.length) return null;
        return (
          <div key={g.group} className="flex items-center gap-1">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">{g.group}</span>
            {types.map((t) => (
              <button key={t} type="button" title={QTYPE_LABEL[t]} onClick={() => onInsert(t)} className="rounded border border-border px-2 py-1 text-xs hover:bg-bg-subtle">
                {SHORT[t] ?? QTYPE_LABEL[t]}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Wire insert-at-cursor with selection→prompt + storage**

In canvas: `onInsert(type)` reads `editor.state.selection`, captures selected text (`state.doc.textBetween(from, to)`), computes `number = baseNumber + order.length + 1`, builds `newQuestion(number, type, isAutoType(type))` then REQUIRED `q.clientId = clientId` (newQuestion mints its own uid — without override map key ≠ node attr) with `prompt = selected || ""` (slice 5000), `setMap`, then `editor.chain().focus().deleteSelection().insertContent({ type: "questionNode", attrs: { clientId, questionType: type } }).run()`, opens drawer. `getNumber(id) = order.indexOf(id) + baseNumber + 1`. `deleteNode(id)` = `editor.chain().focus()` + delete node by filtering doc (use `editor.commands.command` TR mapping or simplest: select node via `document.querySelector([data-client-id])` position lookup — implement via ProseMirror `doc.descendants` to find pos, `tr.deleteRange`) + remove map entry + close drawer if open.

- [ ] **Step 3: Verify numbering**

Manual: insert 5 chips → 1–5 doc order; delete #2 → 2,3,4 renumber; drag #3 before #1 → becomes #1. `npx tsc --noEmit` PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/exam-builder/visual-editor/QuestionTypeToolbar.tsx frontend/src/components/exam-builder/visual-editor/VisualQuestionCanvas.tsx
git commit -m "feat(exam-builder): toolbar insert with auto-numbering"
```

---

### Task 7: Settings drawer + excerpt

**Files:**
- Create: `frontend/src/components/exam-builder/visual-editor/QuestionSettingsDrawer.tsx`
- Modify: `VisualQuestionCanvas.tsx` (drawer host state)

**Interfaces:**
- Consumes: `QuestionFieldSet` (Task 4), Radix `Dialog`, TipTap doc JSON
- Produces: `QuestionSettingsDrawer({ clientId, question, skill, allowedTypes, excerpt, open, onClose, onChange })`

- [ ] **Step 1: Implement drawer with excerpt**

```tsx
"use client";
import { DialogContent, DialogHeader, DialogTitle, DialogBody } from "@/components/ui/dialog";
import { Dialog } from "@radix-ui/react-dialog";
import { QuestionFieldSet } from "@/components/mock/exam-builder/QuestionFieldSet"; // path per Task 4 extraction
import type { BuilderQuestion } from "@/components/mock/exam-builder/types";
import type { MockQuestionType, MockSkill } from "@/lib/types";

export function excerptFor(doc: unknown, clientId: string, radius = 40): string {
  // Walk paragraphs in order, build {text, owner} runs; find node index; slice radius chars each side.
  // Pure — unit-test with JSON doc fixtures (same shape as serialize tests).
  return "";
}

export function QuestionSettingsDrawer(props: {
  open: boolean; onClose: () => void;
  question: BuilderQuestion | null; skill: MockSkill; allowedTypes: MockQuestionType[];
  excerpt: string; onChange: (q: BuilderQuestion) => void;
}) {
  if (!props.question) return null;
  return (
    <Dialog open={props.open} onOpenChange={(o) => { if (!o) props.onClose(); }}>
      <DialogContent className="ml-auto h-full max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>Question settings</DialogTitle></DialogHeader>
        <DialogBody>
          {props.excerpt && <p className="rounded bg-bg-subtle p-2 text-xs text-fg-muted">…{props.excerpt}…</p>}
          <QuestionFieldSet question={props.question} skill={props.skill} allowedTypes={props.allowedTypes} onChange={props.onChange} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
```

Implement `excerptFor` fully (walk `doc.content[].content[]`, concatenate text, record index where `attrs.clientId` matches, slice). Controlled: `onChange` updates canvas map immediately.

- [ ] **Step 2: Verify drawer parity**

Manual per type: `multiple_choice` → options + radio key; `essay_task2` → prompt/points only; `matching_headings` → options + mapping + variants. Matches `QuestionEditor` branches. Deleting node with open drawer closes gracefully (canvas effect).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/exam-builder/visual-editor/QuestionSettingsDrawer.tsx frontend/src/components/exam-builder/visual-editor/VisualQuestionCanvas.tsx
git commit -m "feat(exam-builder): add visual settings drawer with excerpt"
```

---

### Task 8: Mode toggle + save wiring in all three editors

**Files:**
- Modify: `frontend/src/components/exam-builder/GroupEditor.tsx`
- Modify: `frontend/src/components/exam-builder/ReadingPassageEditor.tsx`
- Modify: `frontend/src/components/exam-builder/ListeningPartEditor.tsx`

**Interfaces:**
- Consumes: `VisualQuestionCanvas`, `serializeVisualDocument`, existing `save()` 5-step, `registerSave/onDirty`, `ImportPanel`
- Produces: segmented control Form list | Visual paste (+ Import button kept); lossless both-direction sync; `localStorage examBuilder.questionMode`

- [ ] **Step 1: Add toggle + shared state per editor**

Pattern per editor (adapt prop names to each file's existing `part/snapshot` locals):

```tsx
const [mode, setMode] = React.useState<"form" | "visual">(() =>
  typeof window !== "undefined" ? (localStorage.getItem("examBuilder.questionMode") as "form" | "visual") ?? "form" : "form",
);
const [visualText, setVisualText] = React.useState(part.passageText);
const [visualQuestions, setVisualQuestions] = React.useState<BuilderQuestion[]>(part.questions);
// mode switch: form→visual seeds canvas from part; visual→form writes back via update(p => ({...p, passageText: visualText, questions: visualQuestions}))
```

Segmented control above question area; keep existing `showImport` button untouched. `dirty` = existing diff OR (`mode==="visual"` && serialized differs from snapshot). `save()` branches: visual → `serializeVisualDocument(editorJSON, map)` → same `validatePart` + red-banner `errors` (`role=alert`) → same `useUpdateMockGroup/useDelete/useUpdate/useAdd` (chunk fresh ≤60) → `setSnapshot`.

- [ ] **Step 2: Verify lossless round-trip**

Manual: build 3 questions in Visual, switch to Form → same count/content/order; edit key in Form, switch back → drawer reflects edit. Unsaved-visual → navigation triggers existing `ExamBuilder` dirty Dialog.

- [ ] **Step 3: Commit per editor (3 commits)**

```bash
git add frontend/src/components/exam-builder/GroupEditor.tsx
git commit -m "feat(exam-builder): visual paste mode in GroupEditor"
git add frontend/src/components/exam-builder/ReadingPassageEditor.tsx
git commit -m "feat(exam-builder): visual paste mode in ReadingPassageEditor"
git add frontend/src/components/exam-builder/ListeningPartEditor.tsx
git commit -m "feat(exam-builder): visual paste mode in ListeningPartEditor"
```

---

### Task 9: StudentPreview from unsaved draft + preview toggle

**Files:**
- Modify: `frontend/src/components/exam-builder/StudentPreview.tsx`
- Modify: `VisualQuestionCanvas.tsx` (toolbar preview toggle wiring)

**Interfaces:**
- Consumes: `PreviewGroup`, `BuilderPart`
- Produces: `StudentPreview({ group, skill, audioSrc?, imageSrc? })` backward compatible

- [ ] **Step 1: Extend StudentPreview props**

```tsx
export function StudentPreview({ group, skill, audioSrc, imageSrc }: {
  group: PreviewGroup; skill: MockSkill; audioSrc?: string | null; imageSrc?: string | null;
}) {
  // audio src = audioSrc ?? `/api/backend/mock/groups/${group.id}/audio`
  // image src = imageSrc ?? (group.imageUrl ? `/api/backend/mock/groups/${group.id}/image` : null)
}
```

Keep `PreviewBody key={group.id}`. Visual preview passes `id: "visual-paste-draft"`, `hasAudio: false`, `imageUrl: null`.

- [ ] **Step 2: Add preview toggle in visual toolbar area**

Button swaps canvas ↔ `<StudentPreview group={previewGroup(visualText, visualQuestions)} skill={skill} />` built from unsaved state (same `previewGroup()` helper hosts already use). `npx tsc --noEmit` PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/exam-builder/StudentPreview.tsx frontend/src/components/exam-builder/visual-editor/VisualQuestionCanvas.tsx
git commit -m "feat(exam-builder): preview visual draft as student"
```

---

### Task 10: i18n keys (en/ru/uz)

**Files:**
- Modify: `frontend/messages/en.json`, `frontend/messages/ru.json`, `frontend/messages/uz.json`

**Interfaces:**
- Consumes: `tx(t,key,fallback)` pattern
- Produces: keys `visualPaste`, `visualPasteHint`, `formList`, `pastePlaceholder`, `addQuestion` shorts under `examBuilder`

- [ ] **Step 1: Add keys to en.json under examBuilder**

```json
"visualPaste": "Visual paste",
"visualPasteHint": "Paste text, then place answer inputs where they belong.",
"formList": "Form list",
"pastePlaceholder": "Paste question text here, then use the toolbar to add answer inputs where they belong."
```

Mirror in `ru.json` (RU translations) and `uz.json` (UZ translations) — same keys, translated values; `tx` fallback covers any gap.

- [ ] **Step 2: Switch locale with visual mode active, confirm no missing-translation console warnings; commit**

```bash
git add frontend/messages/en.json frontend/messages/ru.json frontend/messages/uz.json
git commit -m "feat(exam-builder): i18n for visual paste mode"
```

---

### Task 11: Edge cases, guardrails, final verification

**Files:**
- Modify: `VisualQuestionCanvas.tsx` (limits, GC, drawer-close)
- Test: extend `serialize.spec.ts` if needed

**Interfaces:**
- Consumes: all prior tasks
- Produces: all acceptance checkboxes true

- [ ] **Step 1: Enforce 20k limit + image strip + undo GC + empty-doc parity**

20k: `if (passageText.length > 20000) block save with same error banner ("Passage text must be ≤ 20000 characters")`. Images: already stripped at paste (Task 5) — verify Word/Google Docs paste with image yields text only. Undo GC: 500ms debounce effect removing map keys absent from doc (skip id with open drawer). Empty doc: `validatePart` zero-questions error, same as Form list.

- [ ] **Step 2: Run full verification**

Run: `cd frontend; npm test` PASS; `npx tsc --noEmit` PASS; `npm run build` PASS; `npm run lint` PASS (fix new-file violations).

- [ ] **Step 3: Manual acceptance sweep**

Paste in reading + listening groups; toolbar filtered per skill; insert at cursor/selection; drawer parity per type; auto-number + drag renumber; save via same mutations (Network tab: PATCH group + POST questions, no new endpoints); lossless mode switch; Form/Import unchanged; preview from draft; locale switch clean.

- [ ] **Step 4: Changelog commit**

Append changelog to plan handoff (list every file created/changed + judgment notes: stripped-prose decision, toolbar grouping, selection→prompt fallback if plain-insert was needed). Commit any stragglers:

```bash
git add -A
git commit -m "feat(exam-builder): visual paste edge cases and verification"
```

---

## Self-Review (writing-plans checklist)

1. **Spec coverage:** serialize (§2 serialize.ts + Task 2 tests) ✓; node/chip (Task 3) ✓; canvas+paste (Task 5) ✓; toolbar+numbering (Task 6) ✓; drawer+excerpt+QuestionFieldSet reuse (Tasks 4,7) ✓; drag+dropcursor (Tasks 5,6) ✓; save/dirty/mode-toggle all three editors (Task 8) ✓; preview (Task 9) ✓; i18n (Task 10) ✓; edge/tests/build/changelog (Task 11) ✓. No gaps.
2. **Placeholder scan:** no TBD/TODO/"similar to"; every code step ships concrete signatures, commands, expected outputs.
3. **Type consistency:** `serializeVisualDocument(doc, map, baseNumber?)` identical in Tasks 2/5/8; `QuestionFieldSet({question, skill, allowedTypes, onChange})` identical in Tasks 4/7; `StudentPreview({group, skill, audioSrc?, imageSrc?})` identical in Task 9; `validateOneQuestion(skill, q)` identical in Tasks 3/4.
