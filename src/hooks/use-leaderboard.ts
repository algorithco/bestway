"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { LeaderboardRow } from "@/lib/types";

/** GET /points/leaderboard — ochiq reyting (guruh yoki butun markaz) */
export function useLeaderboard(groupId?: string, limit = 50) {
  return useQuery({
    queryKey: ["leaderboard", groupId ?? null, limit],
    queryFn: () => api.get<LeaderboardRow[]>("/points/leaderboard", { groupId, limit }),
  });
}
