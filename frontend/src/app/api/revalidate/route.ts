import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { getSessionRole } from "@/lib/auth";
import { ARTICLES_TAG } from "@/lib/public-api";

/**
 * On-demand kesh tozalash.
 *
 * Ochiq (marketing) sahifalar yangiliklarni ISR bilan keshlaydi (5 daqiqa).
 * Admin yangi maqola qo'shsa/o'zgartirsa, brauzer shu route'ga POST yuboradi va
 * `articles` tegi darhol eskiradi — shunda yangilik saytda o'sha zahoti ko'rinadi.
 *
 * Bu faqat keshni yangilaydi (hech qanday maxfiy ma'lumot ochilmaydi), shuning uchun
 * xavfsiz. Faqat oldindan ruxsat berilgan teglar qabul qilinadi.
 */
const ALLOWED_TAGS = new Set<string>([ARTICLES_TAG]);

export async function POST(request: Request) {
  const role = await getSessionRole();
  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json(
      {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Faqat administratorlar keshni tozalashi mumkin" },
      },
      { status: 401 },
    );
  }

  let tag: string | undefined;
  try {
    const body = (await request.json()) as { tag?: string };
    tag = body.tag;
  } catch {
    // ignore — quyida tekshiriladi
  }

  if (!tag || !ALLOWED_TAGS.has(tag)) {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_TAG", message: "Noma'lum kesh tegi" } },
      { status: 400 },
    );
  }

  // { expire: 0 } — Route Handler'dan darhol eskirtirish (Next 16 usuli)
  revalidateTag(tag, { expire: 0 });

  return NextResponse.json({ success: true, data: { revalidated: tag, now: Date.now() } });
}
