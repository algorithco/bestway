import { setRequestLocale } from "next-intl/server";
import { PaymentsPanel } from "@/components/payments/payments-panel";

export default async function PaymentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PaymentsPanel />;
}
