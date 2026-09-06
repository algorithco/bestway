import "server-only";

import { cookies } from "next/headers";
import { COOKIE } from "./config";
import type { Role } from "./types";

const ACCESS_MAX_AGE = 15 * 60; // 15 daqiqa — backend JWT_ACCESS_TTL bilan bir xil
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30; // 30 kun (JWT_REFRESH_TTL_DAYS)

/** Minimal so'rov shakli — NextRequest bunga to'liq mos keladi. */
export interface RequestLike {
  url: string;
  headers: Headers;
}

/**
 * Cookie'ga `Secure` bayrog'i kerakmi — so'rovning HAQIQIY protokoliga qarab.
 *
 * Eski kod `NODE_ENV === "production"` ga qarab qo'yardi, lekin docker'dagi
 * production frontend oddiy HTTP'da ishlaydi (:3005) — brauzer Secure
 * cookie'ni qaytarib yubormaydi va login ko'ringanicha qolib, barcha
 * auth talab qiladigan amallar (yangilik qo'shish va h.k.) 401 beradi.
 *
 * - `x-forwarded-proto` (cloudflared/reverse-proxy) ustun;
 * - aks holda so'rov URL protokoli (`https:` bo'lsa Secure).
 */
export function isSecureRequest(req: RequestLike): boolean {
  const forwarded = req.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim().toLowerCase() === "https";
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return process.env.NODE_ENV === "production";
  }
}

/** Sessiya cookie'lari uchun umumiy opsiyalar — yaratish/o'chirishda bir xil. */
export function sessionCookieOptions(req?: RequestLike, maxAge?: number) {
  const secure = req ? isSecureRequest(req) : process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    ...(maxAge !== undefined ? { maxAge } : {}),
  } as const;
}

/** JWT payloadini imzoni tekshirmasdan o'qish.
 *
 * Faqat UI qarorlari uchun (qaysi menyuni ko'rsatish, qayerga yo'naltirish).
 * Haqiqiy ruxsat tekshiruvi HAR DOIM backendda — u imzoni tekshiradi.
 */
export function decodeJwt(token: string): { sub?: string; role?: Role; exp?: number } | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = Buffer.from(padded, "base64").toString("utf-8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  role: Role;
}

export async function setSessionCookies(
  { accessToken, refreshToken, role }: SessionTokens,
  req?: RequestLike,
) {
  const jar = await cookies();
  jar.set(COOKIE.access, accessToken, sessionCookieOptions(req, ACCESS_MAX_AGE));
  jar.set(COOKIE.refresh, refreshToken, sessionCookieOptions(req, REFRESH_MAX_AGE));
  jar.set(COOKIE.role, role, sessionCookieOptions(req, REFRESH_MAX_AGE));
}

export async function clearSessionCookies(req?: RequestLike) {
  // O'chirishda ham yaratishdagi atributlar takrorlanadi (ayniqsa `secure`):
  // brauzer atributi mos kelmagan Set-Cookie bilan Secure cookie'ni o'chirmaydi.
  const jar = await cookies();
  jar.set(COOKIE.access, "", sessionCookieOptions(req, 0));
  jar.set(COOKIE.refresh, "", sessionCookieOptions(req, 0));
  jar.set(COOKIE.role, "", sessionCookieOptions(req, 0));
}

export async function getAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE.access)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE.refresh)?.value;
}

export async function getSessionRole(): Promise<Role | undefined> {
  return (await cookies()).get(COOKIE.role)?.value as Role | undefined;
}

/** Rolga mos boshlang'ich sahifa — login qilgandan keyin shu yerga tushadi */
export function homePathForRole(role: Role): string {
  switch (role) {
    case "super_admin":
    case "admin":
    case "teacher":
      return "/dashboard";
    case "student":
    case "parent":
      return "/dashboard";
    default:
      return "/dashboard";
  }
}
