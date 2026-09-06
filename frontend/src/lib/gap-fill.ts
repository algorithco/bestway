/**
 * Gap-fill (IELTS Listening/Reading "ONE WORD AND/OR A NUMBER") helpers.
 *
 * Staff pastes text with blanks marked as 2+ underscores:
 *
 *   Reason for trip: shopping and visit to the __________
 *   Got on bus at __________ Street
 *
 * Each blank becomes one `short_answer` question (auto-graded, `|` alternatives
 * supported by `GradingService.isCorrect`). No backend change needed.
 */

export interface GapSegment {
  kind: "text" | "gap";
  /** Raw text for `text`, "" for `gap`. */
  value: string;
  /** 1-based gap number (only on `gap`). */
  gapIndex?: number;
}

export interface ParsedGapText {
  segments: GapSegment[];
  gapCount: number;
  /** Original lines (kept for per-question prompt context). */
  lines: string[];
}

/** A blank = run of 2+ underscores (Word-style `__________`). */
const GAP_RE = /_{2,}/g;

/** Split pasted text into text/gap segments. Pure — unit-testable. */
export function parseGapText(text: string): ParsedGapText {
  const segments: GapSegment[] = [];
  let gapCount = 0;
  let last = 0;
  GAP_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = GAP_RE.exec(text)) !== null) {
    if (m.index > last) segments.push({ kind: "text", value: text.slice(last, m.index) });
    gapCount += 1;
    segments.push({ kind: "gap", value: "", gapIndex: gapCount });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ kind: "text", value: text.slice(last) });
  return { segments, gapCount, lines: text.split("\n") };
}

/**
 * Soft IELTS check: answer should be ONE WORD AND/OR A NUMBER.
 * Returns true when the answer looks like it violates the limit
 * (contains whitespace between two letter-runs). Numbers with spaces
 * ("12 000") also warn — staff can keep them intentionally.
 */
export function violatesWordLimit(answer: string): boolean {
  const t = answer.trim();
  if (!t) return false;
  // No /s flag: frontend tsconfig targets ES2017. [\s\S] covers newlines.
  return /[A-Za-z][\s\S]*\s+[\s\S]*[A-Za-z]/.test(t);
}

export interface GapQuestionDraft {
  /** 1-based number matching the blank in the pasted text. */
  gapNumber: number;
  /** Line containing the blank, with this blank shown as `[__n__]`. */
  prompt: string;
  /** Full pasted text with blanks numbered `[1]`, `[2]`, … (shared context). */
  passageText: string;
  correctAnswer: string;
}

const WORD_LIMIT_INSTRUCTIONS = "Write ONE WORD AND/OR A NUMBER for each answer.";

/** Number every blank in the text: first `__` → `[1]`, second → `[2]`, … */
export function numberGaps(text: string): string {
  let n = 0;
  return text.replace(GAP_RE, () => {
    n += 1;
    return `[${n}]`;
  });
}

/**
 * Build one draft per blank. `answers` maps gap number → correct answer
 * (`|` separates accepted alternatives, same as backend `correctAnswer`).
 */
export function buildGapQuestions(
  text: string,
  answers: Record<number, string>,
): GapQuestionDraft[] {
  const { gapCount, lines } = parseGapText(text);
  const numbered = numberGaps(text);
  const drafts: GapQuestionDraft[] = [];
  let seen = 0;
  for (const line of lines) {
    // Render this line with ITS blanks numbered globally.
    const rendered = line.replace(GAP_RE, () => {
      seen += 1;
      return `[__${seen}__]`;
    });
    // Emit one draft per blank on this line.
    const blanksOnLine = (line.match(GAP_RE) ?? []).length;
    for (let i = 0; i < blanksOnLine; i += 1) {
      const gapNumber = seen - blanksOnLine + 1 + i;
      drafts.push({
        gapNumber,
        prompt: rendered.trim() || `(gap ${gapNumber})`,
        passageText: numbered,
        correctAnswer: (answers[gapNumber] ?? "").trim(),
      });
    }
  }
  // Safety: if line-splitting drifted (e.g. \r\n), fall back to sequential.
  if (drafts.length !== gapCount) {
    return Array.from({ length: gapCount }, (_, i) => ({
      gapNumber: i + 1,
      prompt: `(gap ${i + 1})`,
      passageText: numbered,
      correctAnswer: (answers[i + 1] ?? "").trim(),
    }));
  }
  return drafts;
}

export interface GapApiPayload {
  section: "listening" | "reading";
  type: "short_answer";
  prompt: string;
  correctAnswer: string;
  maxScore: number;
  passageText: string;
  instructions: string;
}

/** Convert a validated draft to the POST /tests/:id/questions body. */
export function toQuestionPayload(
  draft: GapQuestionDraft,
  section: "listening" | "reading",
): GapApiPayload {
  return {
    section,
    type: "short_answer",
    prompt: draft.prompt,
    correctAnswer: draft.correctAnswer,
    maxScore: 1,
    passageText: draft.passageText,
    instructions: WORD_LIMIT_INSTRUCTIONS,
  };
}

export { WORD_LIMIT_INSTRUCTIONS };
