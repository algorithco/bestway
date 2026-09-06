import { setRequestLocale } from "next-intl/server";
import { getSessionRole } from "@/lib/auth";
import { ExamBuilder } from "@/components/exam-builder/ExamBuilder";
import { Forbidden } from "@/components/exam-builder/Forbidden";

export default async function ExamBuilderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const role = await getSessionRole();
  if (role !== "teacher" && role !== "admin" && role !== "super_admin") {
    return <Forbidden />;
  }
  return <ExamBuilder examId={id} />;
}
