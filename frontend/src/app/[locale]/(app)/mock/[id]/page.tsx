import { setRequestLocale } from "next-intl/server";
import { getSessionRole } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import { MockExamDetailView } from "@/components/mock/mock-exam-detail-view";

export default async function MockExamPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const role = await getSessionRole();
  if (role === "student" || role === "parent") return <MockExamDetailView examId={id} />;
  // Staff authoring lives in the unified Exam Builder — one authoring model.
  // Student/parent detail view above is preserved; attempt routes untouched.
  redirect({ href: `/exam-builder/${id}`, locale });
}
