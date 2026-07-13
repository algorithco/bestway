"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { TelegramLinkToken, TelegramStatus } from "@/lib/types";

export function useTelegramStatus() {
  return useQuery({
    queryKey: ["telegram-status"],
    queryFn: () => api.get<TelegramStatus>("/telegram/status"),
  });
}

export function useTelegramLinkToken() {
  return useMutation({
    mutationFn: () => api.post<TelegramLinkToken>("/telegram/link-token"),
  });
}

export function useUnlinkTelegram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<{ unlinked: boolean }>("/telegram/link"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["telegram-status"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
