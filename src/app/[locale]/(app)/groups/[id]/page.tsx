import { setRequestLocale } from "next-intl/server";
import { GroupDetailView } from "@/components/groups/group-detail-view";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <GroupDetailView groupId={id} />;
}
