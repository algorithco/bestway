"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { DebtorRow, PaymentRow, PaymentState } from "@/lib/types";

function paymentsKey(year: number) {
  return ["payments", year] as const;
}

/** GET /payments?year= — yildagi barcha to'lov yozuvlari (mavjudlari) */
export function usePayments(year: number) {
  return useQuery({
    queryKey: paymentsKey(year),
    queryFn: () => api.get<PaymentRow[]>("/payments", { year }),
  });
}

export interface PaymentCellChange {
  studentId: string;
  studentName: string;
  month: number;
  state: PaymentState;
  amount?: number;
  note?: string | null;
}

/** Bitta katak — PUT /payments/bulk bitta yozuv bilan, optimistik */
export function useSavePaymentCell(year: number) {
  const qc = useQueryClient();
  const key = paymentsKey(year);

  return useMutation({
    mutationFn: (v: PaymentCellChange) =>
      api.put("/payments/bulk", {
        year,
        records: [
          {
            studentId: v.studentId,
            month: v.month,
            state: v.state,
            ...(v.amount !== undefined ? { amount: v.amount } : {}),
            ...(v.note !== undefined && v.note !== null ? { note: v.note } : {}),
          },
        ],
      }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<PaymentRow[]>(key);
      qc.setQueryData<PaymentRow[]>(key, (old = []) => {
        const idx = old.findIndex((r) => r.studentId === v.studentId && r.month === v.month);
        if (idx >= 0) {
          const copy = old.slice();
          copy[idx] = {
            ...copy[idx],
            state: v.state,
            amount: v.amount ?? copy[idx].amount,
            note: v.note !== undefined ? v.note : copy[idx].note,
          };
          return copy;
        }
        return [
          ...old,
          {
            studentId: v.studentId,
            studentName: v.studentName,
            month: v.month,
            year,
            state: v.state,
            amount: v.amount ?? 0,
            method: "manual",
            note: v.note ?? null,
          },
        ];
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
  });
}

/** GET /payments/debtors?year=&month= */
export function useDebtors(year: number, month: number) {
  return useQuery({
    queryKey: ["debtors", year, month],
    queryFn: () => api.get<DebtorRow[]>("/payments/debtors", { year, month }),
  });
}

/** POST /payments/remind — qarzdorlarga eslatma */
export function useRemind(year: number, month: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (studentIds?: string[]) =>
      api.post<{ notified: number }>("/payments/remind", { year, month, studentIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
