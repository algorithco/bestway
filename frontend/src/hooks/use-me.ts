"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import type { Me } from "@/lib/types";

/** Joriy foydalanuvchi profili — proxy orqali (token avtomatik yangilanadi) */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await api.get<Me>("/auth/me");
      } catch (err) {
        // 401 = not logged in, return null instead of throwing
        if (err instanceof ApiError && err.status === 401) {
          return null;
        }
        throw err;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

/** PATCH /auth/me — o'z ismini tahrirlash (barcha rollar) */
export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) => api.patch<Me>("/auth/me", input),
    onSuccess: (me) => {
      qc.setQueryData(["me"], me);
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
