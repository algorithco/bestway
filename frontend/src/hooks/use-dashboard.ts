"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { DashboardStats, IncomePoint } from "@/lib/types";

/** GET /stats/dashboard — admin/super_admin uchun */
export function useDashboardStats() {
  return useQuery({
    queryKey: ["stats", "dashboard"],
    queryFn: () => api.get<DashboardStats>("/stats/dashboard"),
  });
}

/** GET /stats/income — oxirgi N oy tushumi */
export function useIncome(months = 6) {
  return useQuery({
    queryKey: ["stats", "income", months],
    queryFn: () => api.get<IncomePoint[]>("/stats/income", { months }),
  });
}
