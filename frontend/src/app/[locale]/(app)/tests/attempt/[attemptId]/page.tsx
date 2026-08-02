import { setRequestLocale } from "next-intl/server";
import { AttemptView } from "@/components/tests/attempt-view";

export default async function AttemptPage({
  params,
}: {
  params: Promise<{ locale: string; attemptId: string }>;
}) {
  const { locale, attemptId } = await params;
  setRequestLocale(locale);
  return <AttemptView attemptId={attemptId} />;
}
