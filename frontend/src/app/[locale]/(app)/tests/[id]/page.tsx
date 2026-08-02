import { setRequestLocale } from "next-intl/server";
import { TestManageView } from "@/components/tests/test-manage-view";

export default async function TestManagePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <TestManageView testId={id} />;
}
