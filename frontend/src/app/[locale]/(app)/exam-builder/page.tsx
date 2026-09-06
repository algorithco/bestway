import { setRequestLocale } from "next-intl/server";
import { getSessionRole } from "@/lib/auth";
import { ExamBuilderList } from "@/components/exam-builder/ExamBuilderList";
import { Forbidden } from "@/components/exam-builder/Forbidden";

export default async function ExamBuilderPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const role = await getSessionRole();
  if (role !== "teacher" && role !== "admin" && role !== "super_admin") {
    return <Forbidden />;
  }
  return <ExamBuilderList />;
}
