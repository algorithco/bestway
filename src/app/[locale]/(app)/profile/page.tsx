import { setRequestLocale } from "next-intl/server";
import { ProfileView } from "@/components/profile/profile-view";

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProfileView />;
}
