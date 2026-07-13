import { setRequestLocale } from "next-intl/server";
import { MockAttemptClient } from "@/components/mock/mock-attempt-client";

export default async function MockAttemptPage({
  params,
}: {
  params: Promise<{ locale: string; attemptId: string }>;
}) {
  const { locale, attemptId } = await params;
  setRequestLocale(locale);
  return <MockAttemptClient attemptId={attemptId} />;
}
