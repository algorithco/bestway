import { setRequestLocale } from "next-intl/server";
import { StaffView } from "@/components/staff/staff-view";

export default async function StaffPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <StaffView />;
}
