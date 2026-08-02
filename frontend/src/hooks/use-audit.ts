"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { AuditLogItem } from "@/lib/types";

/** GET /audit-logs — faqat super_admin */
export function useAuditLogs(action?: string) {
  return useQuery({
    queryKey: ["audit", action ?? ""],
    queryFn: () => api.get<AuditLogItem[]>("/audit-logs", { action: action || undefined, limit: 60 }),
    placeholderData: (prev) => prev,
  });
}
