import { setRequestLocale } from "next-intl/server";
import { getSessionRole } from "@/lib/auth";
import { StudentTestsView } from "@/components/tests/student-tests-view";
import { StaffTestsView } from "@/components/tests/staff-tests-view";

export default async function TestsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const role = await getSessionRole();

  if (role === "student") return <StudentTestsView />;
  return <StaffTestsView />;
}
