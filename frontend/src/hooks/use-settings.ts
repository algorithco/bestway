"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Settings, UpdateSettingsInput } from "@/lib/types";

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
