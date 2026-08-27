"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { GalleryAdminItem, GalleryImage } from "@/lib/types";

export function useGalleryPublic() {
  return useQuery({
    queryKey: ["gallery"],
    queryFn: () => api.get<GalleryImage[]>("/gallery"),
  });
}

export function useGalleryAdmin() {
  return useQuery({
    queryKey: ["gallery-admin"],
    queryFn: () => api.get<GalleryAdminItem[]>("/gallery/all"),
  });
}

async function revalidateGallery() {
  try {
    await fetch("/api/revalidate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tag: "gallery" }),
    });
  } catch {}
}

async function revalidateTeachers() {
  try {
    await fetch("/api/revalidate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tag: "teachers" }),
    });
  } catch {}
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["gallery"] });
  qc.invalidateQueries({ queryKey: ["gallery-admin"] });
  void revalidateGallery();
  void revalidateTeachers();
}

export function useCreateGallery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) => api.post<GalleryAdminItem>("/gallery", form),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateGallery(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) => api.patch<GalleryAdminItem>(`/gallery/${id}`, form),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteGallery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/gallery/${id}`),
    onSuccess: () => invalidate(qc),
  });
}
