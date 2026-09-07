"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { IeltsBandsResponse, Settings, UpdateIeltsBandsInput, UpdateSettingsInput } from "@/lib/types";

/** GET /settings — ball limitlari va oylik to'lov (admin/teacher ham ko'radi) */
export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<Settings>("/settings"),
    staleTime: 5 * 60_000,
  });
}

/** PATCH /settings — faqat super_admin */
export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSettingsInput) => api.patch<Settings>("/settings", input),
    onSuccess: (data) => qc.setQueryData(["settings"], data),
  });
}

/** GET /settings/ielts-bands — amaldagi xom→band jadvallari */
export function useIeltsBands() {
  return useQuery({
    queryKey: ["ielts-bands"],
    queryFn: () => api.get<IeltsBandsResponse>("/settings/ielts-bands"),
    staleTime: 5 * 60_000,
  });
}

/** PUT /settings/ielts-bands — faqat super_admin */
export function useUpdateIeltsBands() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateIeltsBandsInput) => api.put<IeltsBandsResponse>("/settings/ielts-bands", input),
    onSuccess: (data) => qc.setQueryData(["ielts-bands"], data),
  });
}

/** DELETE /settings/ielts-bands — standartga qaytarish, faqat super_admin */
export function useResetIeltsBands() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<IeltsBandsResponse>("/settings/ielts-bands"),
    onSuccess: (data) => qc.setQueryData(["ielts-bands"], data),
  });
}
