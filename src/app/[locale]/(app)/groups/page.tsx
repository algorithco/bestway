import { setRequestLocale } from "next-intl/server";
import { GroupsView } from "@/components/groups/groups-view";

export default async function GroupsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <GroupsView />;
}
