import { API_URL } from "./config";
import type { ApiResponse, Article } from "./types";

/**
 * Ochiq (auth talab qilmaydigan) backend so'rovlari — rasmiy sayt uchun.
 * Faqat serverda ishlaydi. Backend o'chiq bo'lsa ham sayt qulamasin:
 * har qanday xatoda bo'sh natija qaytaramiz.
 *
 * `tags` — on-demand revalidatsiya uchun (masalan admin yangi maqola qo'shsa,
 * `/api/revalidate` shu tegni tozalaydi va yangilik darhol ko'rinadi).
 */
async function publicGet<T>(
  path: string,
  opts: { revalidate?: number; tags?: string[] } = {},
): Promise<T | null> {
  const { revalidate = 300, tags } = opts;
  try {
    const res = await fetch(`${API_URL}${path}`, {
      next: { revalidate, ...(tags ? { tags } : {}) },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as ApiResponse<T>;
    return json.success ? json.data : null;
  } catch {
    // Backend o'chiq / tarmoq xatosi — sahifa baribir ishlashi kerak
    return null;
  }
}

/** Ochiq maqola so'rovlarining kesh tegi — admin o'zgartirsa shu teg tozalanadi */
export const ARTICLES_TAG = "articles";

/** So'nggi yangiliklar (rasmiy sayt bosh sahifasi uchun) */
export async function getLatestArticles(limit = 3): Promise<Article[]> {
  const data = await publicGet<Article[]>(`/articles?limit=${limit}`, { tags: [ARTICLES_TAG] });
  return data ?? [];
}

/** Barcha yangiliklar (yangiliklar sahifasi) */
export async function getArticles(limit = 24): Promise<Article[]> {
  const data = await publicGet<Article[]>(`/articles?limit=${limit}`, { tags: [ARTICLES_TAG] });
  return data ?? [];
}

/** Bitta maqola (yangilik tafsiloti) */
export async function getArticle(id: string): Promise<Article | null> {
  return publicGet<Article>(`/articles/${encodeURIComponent(id)}`, { tags: [ARTICLES_TAG] });
}
