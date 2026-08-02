import { setRequestLocale } from "next-intl/server";
import { MockExamsView } from "@/components/mock/mock-exams-view";

export default async function MockPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MockExamsView />;
}
