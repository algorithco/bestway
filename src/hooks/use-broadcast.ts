"use client";

import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { BroadcastInput } from "@/lib/types";

/** POST /notifications/broadcast — admin e'lon yuboradi */
export function useBroadcast() {
  return useMutation({
    mutationFn: (input: BroadcastInput) =>
      api.post<{ notified: number }>("/notifications/broadcast", input),
  });
}
