import { NextRequest, NextResponse } from "next/server";
import { API_URL } from "@/lib/config";
import { clearSessionCookies, getAccessToken, getRefreshToken } from "@/lib/auth";

/** Chiqish — backendda refresh tokenni bekor qilamiz va cookie'larni tozalaymiz */
export async function POST(req: NextRequest) {
  const accessToken = await getAccessToken();
  const refreshToken = await getRefreshToken();

  if (accessToken) {
    // Backend javobi muhim emas: cookie baribir tozalanadi, aks holda
    // foydalanuvchi "chiqa olmay" qolib ketadi.
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(refreshToken ? { refreshToken } : {}),
      cache: "no-store",
    }).catch(() => undefined);
  }

  await clearSessionCookies(req);
  return NextResponse.json({ success: true, data: { loggedOut: true } });
}
