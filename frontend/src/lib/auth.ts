import "server-only";

import { cookies } from "next/headers";
import { COOKIE } from "./config";
import type { Role } from "./types";

const ACCESS_MAX_AGE = 60 * 60; // access token 15 daqiqa yashaydi; cookie biroz uzunroq — muddatini backend hal qiladi
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30; // 30 kun (JWT_REFRESH_TTL_DAYS)

const baseCookie = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

/** JWT payloadini imzoni tekshirmasdan o'qish.
 *
 * Faqat UI qarorlari uchun (qaysi menyuni ko'rsatish, qayerga yo'naltirish).
 * Haqiqiy ruxsat tekshiruvi HAR DOIM backendda — u imzoni tekshiradi.
 */
export function decodeJwt(token: string): { sub?: string; role?: Role; exp?: number } | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
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

export async function setSessionCookies({ accessToken, refreshToken, role }: SessionTokens) {
  const jar = await cookies();
  jar.set(COOKIE.access, accessToken, { ...baseCookie, maxAge: ACCESS_MAX_AGE });
  jar.set(COOKIE.refresh, refreshToken, { ...baseCookie, maxAge: REFRESH_MAX_AGE });
  jar.set(COOKIE.role, role, { ...baseCookie, maxAge: REFRESH_MAX_AGE });
}

export async function clearSessionCookies() {
  const jar = await cookies();
  jar.delete(COOKIE.access);
  jar.delete(COOKIE.refresh);
  jar.delete(COOKIE.role);
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
