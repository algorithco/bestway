import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getDemoTest, getDemoTests } from "@/lib/public-api";
import DemoRunner from "@/components/demo/demo-runner";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const test = await getDemoTest(id);
  if (!test) return { title: "Demo" };
  return { title: `${test.title} — Demo` };
}

export async function generateStaticParams() {
  // Allow dynamic; we don't pre-generate but provide hook for ISR
  return [];
}

export default async function DemoDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("marketing");
  // Try fetching detail via public API (OptionalAuth on backend). If 401/null, we still render fallback.
  const test = await getDemoTest(id);

  // If backend has no demo tests at all and this id doesn't exist, try to verify via list to give 404
  // but keep graceful fallback for MVP: if list is empty and detail is null, still show runner with mock
  if (!test) {
    // Attempt to check if any demo tests exist to decide 404 vs fallback
    // For MVP we treat unknown id as 404 only when list exists and id not in it
    const list = await getDemoTests();
    const exists = list.some((x) => x.id === id);
    if (list.length > 0 && !exists) {
      notFound();
    }
    // Otherwise render fallback mock runner (so UI is demonstrable even without backend seed)
  }

  const title = test?.title ?? t("demoTitle");
  const durationMinutes = test?.durationMinutes ?? 10;
  // Pass questions if backend returned them (staff view); guests normally get no questions -> runner falls back to mock
  const questions = (test as unknown as { questions?: unknown })?.questions as
    | { id: string; prompt: string; correctAnswer?: string | null; section?: string; type?: string; maxScore?: number; options?: string[] | null }[]
    | undefined;

  // Normalize if questions are in TestDetail.questions (TestQuestionFull)
  const normalized = Array.isArray(questions)
    ? questions.map((q, idx) => ({
        id: q.id ?? `q-${idx}`,
        prompt: q.prompt,
        correctAnswer: (q as { correctAnswer?: string | null }).correctAnswer ?? null,
        section: (q as { section?: string }).section ?? "listening",
        type: (q as { type?: string }).type ?? "short_answer",
        maxScore: (q as { maxScore?: number }).maxScore ?? 1,
        options: (q as { options?: string[] | null }).options ?? null,
      }))
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/demo"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="size-4" />
        {t("demoTitle")}
      </Link>

      <div className="mt-6">
        <DemoRunner
          testId={id}
          title={title}
          durationMinutes={durationMinutes}
          initialQuestions={normalized}
        />
      </div>
    </div>
  );
}
