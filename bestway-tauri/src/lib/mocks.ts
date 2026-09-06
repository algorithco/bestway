/**
 * Mock exam client for the Tauri app.
 * Mirrors frontend's GET /mock/exams for students (published + demo).
 * Backend: GET /mock/exams -> MockExamListItem[] (wrapped in {success,data})
 */
import { get, post } from "./api";

export type MockExamType = "ielts_academic" | "ielts_general" | "multilevel";
export type MockSkill = "listening" | "reading" | "writing" | "speaking";
export type MockAccess = "granted" | "pending" | "locked";

export interface MockExamListItem {
  id: string;
  type: MockExamType;
  title: string;
  description: string | null;
  level: string | null;
  isDemo: boolean;
  isPublished: boolean;
  skills: MockSkill[];
  questionCount: number;
  durationMinutes: number | null;
  price: number;
  access: MockAccess;
}

export interface MockStartResult {
  attemptId: string;
  examId: string;
  status: string;
}

/** Published + demo mocks visible to the signed-in student. */
export function listMockExams(): Promise<MockExamListItem[]> {
  return get<MockExamListItem[]>("/mock/exams");
}

export function startMockExam(examId: string): Promise<MockStartResult> {
  return post<MockStartResult>(`/mock/exams/${encodeURIComponent(examId)}/start`, {});
}
