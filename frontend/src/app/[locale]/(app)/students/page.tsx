import { setRequestLocale } from "next-intl/server";
import { StudentsView } from "@/components/students/students-view";

export default async function StudentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <StudentsView />;
}
