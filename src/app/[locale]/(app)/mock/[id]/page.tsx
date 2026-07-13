import { setRequestLocale } from "next-intl/server";
import { getSessionRole } from "@/lib/auth";
import { MockExamDetailView } from "@/components/mock/mock-exam-detail-view";
import { MockManageView } from "@/components/mock/mock-manage-view";

export default async function MockExamPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const role = await getSessionRole();
  if (role === "student" || role === "parent") return <MockExamDetailView examId={id} />;
  return <MockManageView examId={id} />;
}
