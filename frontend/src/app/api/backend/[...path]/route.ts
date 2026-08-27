import { NextRequest, NextResponse } from "next/server";
import { API_URL, COOKIE } from "@/lib/config";

/**
 * Backend uchun proxy.
 *
 * Nima uchun kerak: access token httpOnly cookie'da yotadi, ya'ni brauzerdagi JS
 * uni o'qiy olmaydi (XSS bo'lsa ham o'g'irlanmaydi). Demak `Authorization: Bearer`
 * sarlavhasini faqat server qo'sha oladi. Client `/api/backend/...` ga uradi,
 * shu handler cookie'ni olib, backendga Bearer bilan uzatadi.
 *
 * Bonus: access token eskirsa (15 daqiqa), bu yerda jimgina refresh qilinadi va
 * so'rov qayta yuboriladi — foydalanuvchi hech narsani sezmaydi.
 */

/** fetch javobni o'zi ochadi/yig'adi — bu sarlavhalarni uzatish javobni buzadi */
const STRIPPED_RESPONSE_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
]);

const STRIPPED_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "accept-encoding",
  "cookie",
]);

const ACCESS_COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60,
};
const REFRESH_COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

function buildTargetUrl(path: string[], search: string): string {
  const suffix = path.map(encodeURIComponent).join("/");
  return `${API_URL}/${suffix}${search}`;
}

function forwardHeaders(req: NextRequest, accessToken?: string): Headers {
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  return headers;
}

/** Backenddan yangi tokenlar so'rash. Muvaffaqiyatsiz bo'lsa — null. */
async function refreshSession(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken?: string } | null> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      success: boolean;
      data?: { accessToken?: string; refreshToken?: string };
    };
    if (!json.success || !json.data?.accessToken) return null;
    return { accessToken: json.data.accessToken, refreshToken: json.data.refreshToken };
  } catch {
    return null;
  }
}

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const target = buildTargetUrl(path, req.nextUrl.search);

  const accessToken = req.cookies.get(COOKIE.access)?.value;
  const refreshToken = req.cookies.get(COOKIE.refresh)?.value;

  // Body'ni bir marta o'qib olamiz — 401 bo'lsa so'rovni qayta yuborish kerak
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await req.arrayBuffer() : undefined;

  const send = (token?: string) =>
    fetch(target, {
      method: req.method,
      headers: forwardHeaders(req, token),
      body: body && body.byteLength > 0 ? body : undefined,
      cache: "no-store",
      redirect: "manual",
    });

  let upstream: Response;
  try {
    upstream = await send(accessToken);
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "BACKEND_UNREACHABLE", message: "Server bilan aloqa yo'q" } },
      { status: 502 },
    );
  }

  let renewed: { accessToken: string; refreshToken?: string } | null = null;
  let sessionExpired = false;

  if (upstream.status === 401) {
    renewed = refreshToken ? await refreshSession(refreshToken) : null;
    if (renewed) {
      try {
        upstream = await send(renewed.accessToken);
      } catch {
        return NextResponse.json(
          {
            success: false,
            error: { code: "BACKEND_UNREACHABLE", message: "Server bilan aloqa yo'q" },
          },
          { status: 502 },
        );
      }
    }
    if (upstream.status === 401) {
      sessionExpired = true;
    }
  }

  const headers = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });

  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });

  if (renewed) {
    response.cookies.set(COOKIE.access, renewed.accessToken, ACCESS_COOKIE);
    if (renewed.refreshToken) {
      response.cookies.set(COOKIE.refresh, renewed.refreshToken, REFRESH_COOKIE);
    }
  }

  // Refresh ham o'lgan — sessiya tugagan, cookie'larni tozalaymiz.
  // Client `SESSION_EXPIRED` ni ko'rib login sahifasiga o'tadi.
  if (sessionExpired) {
    response.cookies.delete(COOKIE.access);
    response.cookies.delete(COOKIE.refresh);
    response.cookies.delete(COOKIE.role);
  }

  return response;
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;

export const dynamic = "force-dynamic";
