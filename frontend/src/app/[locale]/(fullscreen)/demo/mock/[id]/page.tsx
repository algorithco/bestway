import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { CdExamView } from "@/components/demo/cd-exam-view";
import { getDemoMockExam } from "@/lib/public-api";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const exam = await getDemoMockExam(id);
  if (!exam) return { title: "Demo" };
  return { title: `${exam.title} — Demo` };
}

export default async function DemoMockDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  // Guest shaped detail — correct answers are stripped by the backend.
  const exam = await getDemoMockExam(id);
  if (!exam) notFound();

  return <CdExamView exam={exam} />;
}
