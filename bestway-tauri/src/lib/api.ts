/**
 * Direct fetch client for the BestWay backend.
 *
 * - Base URL: `VITE_API_URL` or `http://localhost:3001/v1`
 * - Auth: Bearer access token from session (localStorage + memory)
 * - No Next.js proxy — Tauri talks straight to the backend.
 */

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  [key: string]: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  status: number;
}

export type QueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number | boolean>;

export type QueryParams = Record<string, QueryValue>;

const DEFAULT_BASE_URL = "http://localhost:3001/v1";

function resolveBaseUrl(): string {
  const fromEnv =
    typeof import.meta !== "undefined"
      ? (import.meta.env?.VITE_API_URL as string | undefined)
      : undefined;
  const raw = (fromEnv ?? DEFAULT_BASE_URL).trim();
  return raw.replace(/\/+$/, "");
}

export const API_BASE_URL = resolveBaseUrl();

const ACCESS_KEY = "bestway.accessToken";
const REFRESH_KEY = "bestway.refreshToken";

let memoryAccessToken: string | null = null;
let memoryRefreshToken: string | null = null;

function readStorage(key: string): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (typeof localStorage === "undefined") return;
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Tauri webview / private mode: keep memory-only session.
  }
}

export function getAccessToken(): string | null {
  return memoryAccessToken ?? readStorage(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return memoryRefreshToken ?? readStorage(REFRESH_KEY);
}

export function setSession(accessToken: string | null, refreshToken?: string | null): void {
  memoryAccessToken = accessToken;
  writeStorage(ACCESS_KEY, accessToken);
  if (refreshToken !== undefined) {
    memoryRefreshToken = refreshToken;
    writeStorage(REFRESH_KEY, refreshToken);
  }
}

export function clearSession(): void {
  memoryAccessToken = null;
  memoryRefreshToken = null;
  writeStorage(ACCESS_KEY, null);
  writeStorage(REFRESH_KEY, null);
}

/** Build `?a=1&b=2` query string from a params object. Returns `""` when empty. */
export function buildQuery(params?: QueryParams): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, String(item));
    } else {
      search.append(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  query?: QueryParams;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: any;
  token?: string | null;
}

function toApiError(status: number, payload: unknown, fallback: string): ApiError {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    // Backend may return { success: false, error: { code, message } } or { code, message }.
    const nested = p.error as Record<string, unknown> | undefined;
    const code =
      (nested?.code as string | undefined) ??
      (p.code as string | undefined) ??
      `HTTP_${status}`;
    const message =
      (nested?.message as string | undefined) ??
      (p.message as string | undefined) ??
      fallback;
    return { code, message, status };
  }
  return { code: `HTTP_${status}`, message: fallback, status };
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { query, body, token, headers, ...rest } = options;
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}${buildQuery(query)}`;

  const accessToken = token !== undefined ? token : getAccessToken();

  const res = await fetch(url, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(headers ?? {}),
    },
    body: body === undefined || typeof body === "string" ? body : JSON.stringify(body),
  });

  const text = await res.text();
  const payload: unknown = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    throw toApiError(res.status, payload, `Request failed: ${res.status}`);
  }

  // Backend wraps data as ApiResponse<T>; unwrap to T for callers.
  if (payload && typeof payload === "object" && "data" in (payload as Record<string, unknown>)) {
    return (payload as ApiResponse<T>).data;
  }
  return payload as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function get<T>(path: string, query?: QueryParams, init?: RequestOptions): Promise<T> {
  return request<T>(path, { ...init, query, method: "GET" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function post<T>(path: string, body?: any, init?: RequestOptions): Promise<T> {
  return request<T>(path, { ...init, method: "POST", body });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function put<T>(path: string, body?: any, init?: RequestOptions): Promise<T> {
  return request<T>(path, { ...init, method: "PUT", body });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function patch<T>(path: string, body?: any, init?: RequestOptions): Promise<T> {
  return request<T>(path, { ...init, method: "PATCH", body });
}

export function del<T>(path: string, query?: QueryParams, init?: RequestOptions): Promise<T> {
  return request<T>(path, { ...init, query, method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  phone: string;
  name?: string;
  role?: string;
  [key: string]: unknown;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export async function login(phone: string, password: string): Promise<AuthSession> {
  const session = await post<AuthSession>("/auth/login", { phone, password }, { token: null });
  if (session?.accessToken) {
    setSession(session.accessToken, session.refreshToken ?? null);
  }
  return session;
}

export async function refresh(): Promise<AuthSession> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw { code: "NO_REFRESH_TOKEN", message: "No refresh token in session", status: 401 } as ApiError;
  }
  const session = await post<AuthSession>("/auth/refresh", { refreshToken }, { token: null });
  if (session?.accessToken) {
    setSession(session.accessToken, session.refreshToken ?? refreshToken);
  }
  return session;
}

export async function logout(): Promise<void> {
  try {
    await post<void>("/auth/logout", { refreshToken: getRefreshToken() ?? undefined });
  } catch {
    // Logout is best-effort; always clear local session.
  } finally {
    clearSession();
  }
}
