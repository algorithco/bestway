"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  AttemptDetail,
  AttemptStatus,
  AttemptSummary,
  CreateQuestionInput,
  CreateTestInput,
  StartResult,
  TestDetail,
  TestListItem,
  TestImportPreview,
  TestSection,
  TestType,
} from "@/lib/types";

export function useTests(type?: TestType) {
  return useQuery({
    queryKey: ["tests", type ?? "all"],
    queryFn: () => api.get<TestListItem[]>("/tests", { type }),
  });
}

export function useTest(id?: string) {
  return useQuery({
    queryKey: ["test", id],
    queryFn: () => api.get<TestDetail>(`/tests/${id}`),
    enabled: !!id,
  });
}

export function useStartTest() {
  return useMutation({
    mutationFn: (testId: string) => api.post<StartResult>(`/tests/${testId}/start`),
  });
}

export function useSaveAnswer(attemptId: string) {
  return useMutation({
    mutationFn: (v: { questionId: string; answer: string }) =>
      api.post(`/tests/attempts/${attemptId}/answer`, v),
  });
}

export function useSubmitAttempt(attemptId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ status: AttemptStatus; autoScore: number }>(
      `/tests/attempts/${attemptId}/submit`,
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-attempts"] });
      qc.invalidateQueries({ queryKey: ["attempts"] });
      qc.invalidateQueries({ queryKey: ["attempt", attemptId] });
    },
  });
}

export function useFlagCheat(attemptId: string) {
  return useMutation({
    mutationFn: (event: string) =>
      api.post(`/tests/attempts/${attemptId}/flag-cheat`, { event }),
  });
}

export function useMyAttempts(status?: AttemptStatus) {
  return useQuery({
    queryKey: ["my-attempts", status ?? "all"],
    queryFn: () => api.get<AttemptSummary[]>("/tests/attempts/mine", { status }),
  });
}

export function useAttempts(status?: AttemptStatus) {
  return useQuery({
    queryKey: ["attempts", status ?? "all"],
    queryFn: () => api.get<AttemptSummary[]>("/tests/attempts", { status }),
  });
}

export function useAttempt(attemptId?: string) {
  return useQuery({
    queryKey: ["attempt", attemptId],
    queryFn: () => api.get<AttemptDetail>(`/tests/attempts/${attemptId}`),
    enabled: !!attemptId,
  });
}

export function useGradeAnswer(attemptId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { questionId: string; score: number; comment?: string }) =>
      api.post(`/tests/attempts/${attemptId}/grade`, v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attempt", attemptId] });
      qc.invalidateQueries({ queryKey: ["attempts"] });
    },
  });
}

/* ── Admin ── */

export function useCreateTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTestInput) => api.post<TestDetail>("/tests", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tests"] }),
  });
}

export function useUpdateTest(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CreateTestInput> & { isActive?: boolean }) =>
      api.patch<TestDetail>(`/tests/${id}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tests"] });
      qc.invalidateQueries({ queryKey: ["test", id] });
    },
  });
}

export function useAddQuestion(testId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateQuestionInput) => api.post(`/tests/${testId}/questions`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["test", testId] });
      qc.invalidateQueries({ queryKey: ["tests"] });
    },
  });
}

export function usePreviewQuestionImport() {
  return useMutation({
    mutationFn: (input: { text: string; defaultSection?: TestSection }) =>
      api.post<TestImportPreview>("/tests/questions/import/preview", input),
  });
}

export function useImportQuestions(testId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { text: string; defaultSection?: TestSection }) =>
      api.post<{ added: number; sectionCounts: Partial<Record<TestSection, number>> }>(
        `/tests/${testId}/questions/import`,
        input,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["test", testId] });
      qc.invalidateQueries({ queryKey: ["tests"] });
    },
  });
}

export function useDeleteQuestion(testId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (questionId: string) => api.delete(`/tests/questions/${questionId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["test", testId] });
      qc.invalidateQueries({ queryKey: ["tests"] });
    },
  });
}

export function useUpdateQuestion(testId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { questionId: string; input: Partial<CreateQuestionInput> }) =>
      api.patch(`/tests/questions/${v.questionId}`, v.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["test", testId] }),
  });
}

export function useUploadQuestionAudio(testId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { questionId: string; file: File }) => {
      const fd = new FormData();
      fd.append("audio", v.file);
      // api client handles FormData without JSON header
      const res = await fetch(`/api/backend/tests/questions/${v.questionId}/audio`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json() as import("@/lib/types").ApiResponse<{ audioUrl: string; audioEndpoint: string; hasAudio: boolean }>;
      if (!res.ok || !json.success) {
        const msg = "error" in json ? json.error.message : "Audio upload failed";
        throw new Error(msg);
      }
      return json.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["test", testId] }),
  });
}
