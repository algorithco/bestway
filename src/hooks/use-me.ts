"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Me } from "@/lib/types";

/** Joriy foydalanuvchi profili — proxy orqali (token avtomatik yangilanadi) */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<Me>("/auth/me"),
    staleTime: 60_000,
  });
}
