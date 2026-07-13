import { setRequestLocale } from "next-intl/server";
import { AttendancePanel } from "@/components/attendance/attendance-panel";

export default async function AttendancePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AttendancePanel />;
}
