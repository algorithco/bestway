import { MockExamType, MockQuestionType, MockSkill } from '@prisma/client';

/**
 * Exam tuzilmasini javobga o'girish — sof funksiyalar.
 * includeAnswers=false bo'lsa o'quvchiga to'g'ri javob YUBORILMAYDI.
 */

export interface QuestionRow {
  id: string;
  number: number;
  sortOrder: number;
  type: MockQuestionType;
  prompt: string;
  options: unknown;
  correctAnswers: unknown;
  acceptedVariants: unknown;
  points: number;
  wordLimit: number | null;
}

export interface GroupRow {
  id: string;
  sortOrder: number;
  title: string | null;
  instructions: string | null;
  passageText: string | null;
  audioKey: string | null;
  imageKey: string | null;
  partNumber: number | null;
  audioDurationSec: number | null;
  audioPlayLimit: number;
  questions: QuestionRow[];
}

export interface SectionRow {
  id: string;
  skill: MockSkill;
  title: string | null;
  sortOrder: number;
  durationMinutes: number | null;
  instructions: string | null;
  groups: GroupRow[];
}

export interface ExamRow {
  id: string;
  type: MockExamType;
  title: string;
  description: string | null;
  level: string | null;
  isPublished: boolean;
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
  sections: SectionRow[];
}

function asStringArray(v: unknown): string[] | null {
  return Array.isArray(v) ? (v as string[]) : null;
}

export function shapeQuestion(q: QuestionRow, includeAnswers: boolean) {
  return {
    id: q.id,
    number: q.number,
    sortOrder: q.sortOrder,
    type: q.type,
    prompt: q.prompt,
    options: asStringArray(q.options),
    points: q.points,
    wordLimit: q.wordLimit,
    ...(includeAnswers
      ? {
          correctAnswers: asStringArray(q.correctAnswers),
          acceptedVariants: asStringArray(q.acceptedVariants),
        }
      : {}),
  };
}

export function shapeGroup(g: GroupRow, includeAnswers: boolean, base: string) {
  return {
    id: g.id,
    sortOrder: g.sortOrder,
    title: g.title,
    instructions: g.instructions,
    passageText: g.passageText,
    hasAudio: !!g.audioKey,
    audioUrl: g.audioKey ? `${base}/mock/groups/${g.id}/audio` : null,
    imageUrl: g.imageKey ? `${base}/mock/groups/${g.id}/image` : null,
    partNumber: g.partNumber,
    audioDurationSec: g.audioDurationSec,
    audioPlayLimit: g.audioPlayLimit,
    questions: [...g.questions]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.number - b.number)
      .map((q) => shapeQuestion(q, includeAnswers)),
  };
}

export function shapeSection(s: SectionRow, includeAnswers: boolean, base: string) {
  return {
    id: s.id,
    skill: s.skill,
    title: s.title,
    sortOrder: s.sortOrder,
    durationMinutes: s.durationMinutes,
    instructions: s.instructions,
    groups: [...s.groups]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((g) => shapeGroup(g, includeAnswers, base)),
  };
}

export function countQuestions(exam: ExamRow): number {
  return exam.sections.reduce(
    (sum, s) => sum + s.groups.reduce((gs, g) => gs + g.questions.length, 0),
    0,
  );
}

export function shapeExam(exam: ExamRow, includeAnswers: boolean, base: string) {
  return {
    id: exam.id,
    type: exam.type,
    title: exam.title,
    description: exam.description,
    level: exam.level,
    isPublished: exam.isPublished,
    isDemo: exam.isDemo,
    createdAt: exam.createdAt,
    updatedAt: exam.updatedAt,
    questionCount: countQuestions(exam),
    sections: [...exam.sections]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => shapeSection(s, includeAnswers, base)),
  };
}

/** Bo'lim bo'yicha jami vaqt (daqiqa) — imtihon davomiyligi taxminiy hisobi */
export function totalDuration(exam: ExamRow): number | null {
  const sum = exam.sections.reduce((s, sec) => s + (sec.durationMinutes ?? 0), 0);
  return sum > 0 ? sum : null;
}

/** Kirish huquqi yo'q o'quvchiga — tarkibsiz (sections/savollar/passages) metadata */
export function shapeExamMeta(exam: ExamRow) {
  return {
    id: exam.id,
    type: exam.type,
    title: exam.title,
    description: exam.description,
    level: exam.level,
    isPublished: exam.isPublished,
    isDemo: exam.isDemo,
    createdAt: exam.createdAt,
    updatedAt: exam.updatedAt,
    questionCount: countQuestions(exam),
    durationMinutes: totalDuration(exam),
    sections: [],
  };
}
