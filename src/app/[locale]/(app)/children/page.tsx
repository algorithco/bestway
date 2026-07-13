import { setRequestLocale } from "next-intl/server";
import { ChildrenView } from "@/components/children/children-view";

export default async function ChildrenPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ChildrenView />;
}
