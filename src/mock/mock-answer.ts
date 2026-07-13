import { MockQuestionType } from '@prisma/client';

/**
 * Javob kaliti bo'yicha avtomatik baholash — sof funksiyalar.
 * Real IELTS mock uslubida: registr/probel/tinish belgilaridan qat'i nazar,
 * artikl (a/an/the) ixtiyoriy, raqam↔so'z ekvivalent ("3" == "three").
 */

const NUMBER_WORDS: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5',
  six: '6', seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11',
  twelve: '12', thirteen: '13', fourteen: '14', fifteen: '15', sixteen: '16',
  seventeen: '17', eighteen: '18', nineteen: '19', twenty: '20', thirty: '30',
  forty: '40', fifty: '50', sixty: '60', seventy: '70', eighty: '80',
  ninety: '90', hundred: '100', thousand: '1000',
};
const WORD_BY_NUMBER: Record<string, string> = Object.fromEntries(
  Object.entries(NUMBER_WORDS).map(([w, n]) => [n, w]),
);

/** Kichik harf, tinish belgilarini olib tashlash, ortiqcha probellarni siqish */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()"?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Bitta javob uchun mumkin bo'lgan ekvivalent shakllar to'plami */
function variants(raw: string): Set<string> {
  const out = new Set<string>();
  const base = normalize(raw);
  if (!base) return out;
  out.add(base);

  // Boshidagi artiklni olib tashlash (IELTS ko'pincha a/an/the ni hisobga olmaydi)
  const noArticle = base.replace(/^(a|an|the)\s+/, '');
  out.add(noArticle);

  // Raqam ↔ so'z ekvivalenti (bitta so'zli javoblar uchun)
  for (const form of [base, noArticle]) {
    if (NUMBER_WORDS[form]) out.add(NUMBER_WORDS[form]);
    if (WORD_BY_NUMBER[form]) out.add(WORD_BY_NUMBER[form]);
  }
  return out;
}

/** javob to'plamlaridan biri mos kelsa true */
function anyOverlap(a: Set<string>, b: Set<string>): boolean {
  for (const v of a) if (b.has(v)) return true;
  return false;
}

/** Vergul/probel bilan ajratilgan tanlovlar to'plami (multi_select uchun) */
function toChoiceSet(s: string): Set<string> {
  return new Set(
    s
      .split(/[,;\s]+/)
      .map((x) => normalize(x))
      .filter(Boolean),
  );
}

/**
 * Javob to'g'rimi? correctAnswers — qabul qilinadigan variantlar ro'yxati.
 * multi_select: tanlovlar to'plami aynan mos kelishi kerak (tartibsiz).
 * Qolganlari: variant ekvivalenti bo'yicha mos kelsa yetarli.
 */
export function isAnswerCorrect(
  type: MockQuestionType,
  response: string,
  correctAnswers: string[],
): boolean {
  if (!response || !response.trim() || correctAnswers.length === 0) return false;

  if (type === 'multi_select') {
    const chosen = toChoiceSet(response);
    // Kalit bir nechta element bo'lishi mumkin: har biri alohida yoki bitta "a,b" satrida
    const key = new Set<string>();
    for (const c of correctAnswers) for (const v of toChoiceSet(c)) key.add(v);
    if (chosen.size !== key.size) return false;
    for (const v of chosen) if (!key.has(v)) return false;
    return true;
  }

  const respVariants = variants(response);
  return correctAnswers.some((c) => anyOverlap(respVariants, variants(c)));
}
