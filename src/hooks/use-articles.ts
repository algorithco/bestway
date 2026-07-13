"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Article, CreateArticleInput } from "@/lib/types";

export function useArticlesAdmin() {
  return useQuery({
    queryKey: ["articles-admin"],
    queryFn: () => api.get<Article[]>("/articles", { limit: 50 }),
  });
}

/**
 * Ochiq (marketing) sahifalar yangiliklarni ISR bilan keshlaydi. Maqola
 * o'zgargach shu keshni darhol tozalaymiz — aks holda yangilik saytda
 * 5 daqiqagacha ko'rinmaydi. Xatosi jim yutiladi (admin ro'yxati baribir yangilanadi).
 */
async function revalidatePublicArticles() {
  try {
    await fetch("/api/revalidate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tag: "articles" }),
    });
  } catch {
    // ahamiyatsiz — keyingi ISR aylanishi baribir yangilaydi
  }
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["articles-admin"] });
  void revalidatePublicArticles();
}

export function useCreateArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateArticleInput) => api.post<Article>("/articles", input),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateArticle(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CreateArticleInput>) => api.patch<Article>(`/articles/${id}`, input),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/articles/${id}`),
    onSuccess: () => invalidate(qc),
  });
}
