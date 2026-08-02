"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { PointsDetail } from "@/lib/types";

/** GET /points/:studentId — joriy ball + tarix */
export function usePoints(studentId?: string) {
  return useQuery({
    queryKey: ["points", studentId],
    queryFn: () => api.get<PointsDetail>(`/points/${studentId}`),
    enabled: !!studentId,
  });
}

/** POST /points/:studentId/adjust — sabab bilan ball qo'shish/ayirish */
export function useAdjustPoints(studentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { change: number; reason: string }) =>
      api.post<{ current: number }>(`/points/${studentId}/adjust`, v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["points", studentId] });
      qc.invalidateQueries({ queryKey: ["user", studentId] });
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
      qc.invalidateQueries({ queryKey: ["group"] });
    },
  });
}
