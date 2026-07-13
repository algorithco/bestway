"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { GroupDetail, GroupInput, GroupListItem } from "@/lib/types";

/** GET /groups — rolga qarab foydalanuvchining guruhlari */
export function useGroups() {
  return useQuery({
    queryKey: ["groups"],
    queryFn: () => api.get<GroupListItem[]>("/groups"),
  });
}

/** GET /groups/:id — o'quvchilar va jadval bilan */
export function useGroupDetail(id?: string) {
  return useQuery({
    queryKey: ["group", id],
    queryFn: () => api.get<GroupDetail>(`/groups/${id}`),
    enabled: !!id,
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GroupInput) => api.post<GroupDetail>("/groups", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });
}

export function useUpdateGroup(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<GroupInput>) => api.patch<GroupDetail>(`/groups/${id}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      qc.invalidateQueries({ queryKey: ["group", id] });
    },
  });
}

export function useAddStudentToGroup(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (studentId: string) =>
      api.post(`/groups/${groupId}/students`, { studentId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["group", groupId] });
      qc.invalidateQueries({ queryKey: ["groups"] });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useRemoveStudentFromGroup(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (studentId: string) =>
      api.delete(`/groups/${groupId}/students/${studentId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["group", groupId] });
      qc.invalidateQueries({ queryKey: ["groups"] });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
