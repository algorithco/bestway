import { setRequestLocale } from "next-intl/server";
import { StudentDetailView } from "@/components/students/student-detail-view";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <StudentDetailView studentId={id} />;
}
