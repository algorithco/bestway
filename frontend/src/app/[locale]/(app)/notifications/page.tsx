import { setRequestLocale } from "next-intl/server";
import { NotificationsView } from "@/components/notifications/notifications-view";

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <NotificationsView />;
}
