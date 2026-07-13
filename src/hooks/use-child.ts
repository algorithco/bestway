"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { AttendanceRow, PaymentRow } from "@/lib/types";

/** GET /payments?studentId=&year= — ota-ona farzandining to'lovlari */
export function useChildPayments(studentId?: string, year?: number) {
  return useQuery({
    queryKey: ["child-payments", studentId, year],
    queryFn: () => api.get<PaymentRow[]>("/payments", { studentId, year }),
    enabled: !!studentId,
  });
}

/** GET /attendance?studentId=&month= — farzandning oylik davomati */
export function useChildAttendance(studentId?: string, month?: string) {
  return useQuery({
    queryKey: ["child-attendance", studentId, month],
    queryFn: () => api.get<AttendanceRow[]>("/attendance", { studentId, month }),
    enabled: !!studentId,
  });
}

/** POST /auth/link-child — bog'lash kodi orqali farzandni ulash */
export function useLinkChild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linkCode: string) => api.post("/auth/link-child", { linkCode }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
}
