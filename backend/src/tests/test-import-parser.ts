import { QuestionType, TestSection } from '@prisma/client';

export interface TestImportQuestion {
  number: number;
  line: number;
  section: TestSection;
  type: QuestionType;
  prompt: string;
  options?: string[];
  correctAnswer?: string;
  maxScore: number;
  passageText?: string;
  instructions?: string;
}

export interface TestImportIssue {
  line?: number;
  message: string;
}

export interface TestImportResult {
  questions: TestImportQuestion[];
  errors: TestImportIssue[];
  warnings: TestImportIssue[];
  sectionCounts: Partial<Record<TestSection, number>>;
}

const SECTION_RE = /^\s*(?:\[|#{1,3}\s*)?(listening|reading|writing|speaking)(?:\]|\s+section)?\s*:?\s*$/i;
const SECTION_LABEL_RE = /^\s*section\s*:\s*(listening|reading|writing|speaking)\s*$/i;
const QUESTION_RE = /^\s*(?:q(?:uestion)?\s*)?(\d{1,3})\s*[.)\]:-]\s*(.*)$/i;
const OPTION_RE = /^\s*\(?([A-Ha-h])\)?[.)\]:-]\s*(.+)$/;
const ANSWER_RE = /^\s*(?:answer|correct answer)\s*:\s*(.+)$/i;
const TYPE_RE = /^\s*type\s*:\s*(multiple[_ -]?choice|short[_ -]?answer|essay|speaking[_ -]?prompt)\s*$/i;
const SCORE_RE = /^\s*(?:score|points?)\s*:\s*(\d+)\s*$/i;
const ANSWER_KEY_RE = /^\s*(?:answer\s*key|answers?)\s*:?[\s-]*$/i;
const KEY_ROW_RE = /^\s*(\d{1,3})\s*[:.)-]\s*(.+?)\s*$/;

type Draft = {
  number: number;
  line: number;
  section?: TestSection;
  prompt: string[];
  options: string[];
  answer?: string;
  type?: QuestionType;
  maxScore?: number;
  passageText?: string;
  instructions?: string;
};

function normalizeType(value: string): QuestionType {
  return value.toLowerCase().replace(/[ -]/g, '_') as QuestionType;
}

function resolveAnswer(raw: string | undefined, options: string[]): string | undefined {
  if (!raw?.trim()) return undefined;
  return raw
    .split('|')
    .map((part) => {
      const value = part.trim();
      if (/^[A-H]$/i.test(value)) {
        return options[value.toUpperCase().charCodeAt(0) - 65] ?? value;
      }
      return value;
    })
    .filter(Boolean)
    .join('|');
}

/** Pure parser used by both preview and atomic import. */
export function parseTestImport(text: string, defaultSection?: TestSection): TestImportResult {
  const errors: TestImportIssue[] = [];
  const warnings: TestImportIssue[] = [];
  const drafts: Draft[] = [];
  const answers = new Map<number, { value: string; line: number }>();
  const seenNumbers = new Map<number, number>();
  let section = defaultSection;
  let instructions = '';
  let passage = '';
  let sharedMode: 'instructions' | 'passage' | null = null;
  let current: Draft | null = null;
  let answerKey = false;

  const finish = () => {
    if (!current) return;
    drafts.push(current);
    current = null;
  };

  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trimEnd();
    if (!line.trim()) return;

    const sectionMatch = SECTION_RE.exec(line) ?? SECTION_LABEL_RE.exec(line);
    if (sectionMatch) {
      finish();
      section = sectionMatch[1].toLowerCase() as TestSection;
      instructions = '';
      passage = '';
      sharedMode = null;
      answerKey = false;
      return;
    }
    if (ANSWER_KEY_RE.test(line)) {
      finish();
      answerKey = true;
      sharedMode = null;
      return;
    }
    if (answerKey) {
      const key = KEY_ROW_RE.exec(line);
      if (!key) {
        errors.push({ line: lineNumber, message: 'Answer key line not understood. Use “1: B”.' });
        return;
      }
      const number = Number(key[1]);
      if (answers.has(number)) errors.push({ line: lineNumber, message: `Answer for question ${number} is repeated.` });
      answers.set(number, { value: key[2].trim(), line: lineNumber });
      return;
    }

    const question = QUESTION_RE.exec(line);
    if (question) {
      finish();
      const number = Number(question[1]);
      current = {
        number,
        line: lineNumber,
        section,
        prompt: question[2].trim() ? [question[2].trim()] : [],
        options: [],
        instructions: instructions || undefined,
        passageText: passage || undefined,
      };
      sharedMode = null;
      if (seenNumbers.has(number)) {
        errors.push({ line: lineNumber, message: `Question number ${number} is repeated (first used on line ${seenNumbers.get(number)}).` });
      } else seenNumbers.set(number, lineNumber);
      return;
    }

    if (!current) {
      const instruction = /^\s*instructions?\s*:\s*(.*)$/i.exec(line);
      const passageLine = /^\s*passage\s*:\s*(.*)$/i.exec(line);
      if (instruction) {
        instructions = instruction[1].trim();
        sharedMode = 'instructions';
      } else if (passageLine) {
        passage = passageLine[1].trim();
        sharedMode = 'passage';
      } else if (sharedMode === 'instructions') {
        instructions = `${instructions}\n${line.trim()}`.trim();
      } else if (sharedMode === 'passage') {
        passage = `${passage}\n${line.trim()}`.trim();
      } else {
        warnings.push({ line: lineNumber, message: 'Text before the first question was ignored. Prefix it with “Instructions:” or “Passage:”.' });
      }
      return;
    }

    const option = OPTION_RE.exec(line);
    const answer = ANSWER_RE.exec(line);
    const type = TYPE_RE.exec(line);
    const score = SCORE_RE.exec(line);
    if (option) current.options.push(option[2].trim());
    else if (answer) current.answer = answer[1].trim();
    else if (type) current.type = normalizeType(type[1]);
    else if (score) current.maxScore = Number(score[1]);
    else current.prompt.push(line.trim());
  });
  finish();

  if (!drafts.length) errors.push({ message: 'No numbered questions found. Use “1. Question text”.' });
  if (drafts.length > 200) errors.push({ message: 'A single import can contain at most 200 questions.' });

  const questions: TestImportQuestion[] = drafts.map((draft) => {
    const prompt = draft.prompt.join(' ').replace(/\s+/g, ' ').trim();
    const resolvedSection = draft.section ?? defaultSection;
    const type = draft.type ?? (resolvedSection === 'writing' ? 'essay' : resolvedSection === 'speaking' ? 'speaking_prompt' : draft.options.length >= 2 ? 'multiple_choice' : 'short_answer');
    const rawAnswer = draft.answer ?? answers.get(draft.number)?.value;
    const correctAnswer = resolveAnswer(rawAnswer, draft.options);
    if (!resolvedSection) errors.push({ line: draft.line, message: `Question ${draft.number} has no section. Add [READING] or choose a default section.` });
    if (prompt.length < 3) errors.push({ line: draft.line, message: `Question ${draft.number} needs at least 3 characters.` });
    if (type === 'multiple_choice' && draft.options.length < 2) errors.push({ line: draft.line, message: `Question ${draft.number} needs at least two options.` });
    if ((resolvedSection === 'listening' || resolvedSection === 'reading') && !correctAnswer) errors.push({ line: draft.line, message: `Question ${draft.number} needs an answer.` });
    const maxScore = draft.maxScore ?? 1;
    if (!Number.isInteger(maxScore) || maxScore < 1 || maxScore > 100) errors.push({ line: draft.line, message: `Question ${draft.number} score must be 1–100.` });
    return {
      number: draft.number,
      line: draft.line,
      section: resolvedSection ?? 'reading',
      type,
      prompt,
      ...(draft.options.length ? { options: draft.options } : {}),
      ...(correctAnswer ? { correctAnswer } : {}),
      maxScore,
      ...(draft.passageText ? { passageText: draft.passageText } : {}),
      ...(draft.instructions ? { instructions: draft.instructions } : {}),
    };
  });

  for (const [number, answer] of answers) {
    if (!seenNumbers.has(number)) warnings.push({ line: answer.line, message: `Answer ${number} has no matching question and will be ignored.` });
  }
  const sectionCounts: Partial<Record<TestSection, number>> = {};
  questions.forEach((question) => { sectionCounts[question.section] = (sectionCounts[question.section] ?? 0) + 1; });
  return { questions, errors, warnings, sectionCounts };
}
