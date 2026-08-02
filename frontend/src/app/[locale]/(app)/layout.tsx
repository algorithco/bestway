import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { AppSidebar } from "@/components/app/app-sidebar";
import { AppTopbar } from "@/components/app/app-topbar";
import { MobileNav } from "@/components/app/mobile-nav";
import { getSessionRole } from "@/lib/auth";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Middleware allaqachon tekshiradi, bu ikkilamchi himoya (rol cookie'siz kirilmasin)
  const role = await getSessionRole();
  if (!role) redirect("/login");

  return (
    <div className="flex min-h-dvh bg-bg">
      <AppSidebar role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar role={role} />
        <main className="flex-1 px-4 pt-6 pb-24 sm:px-6 lg:pb-8">{children}</main>
      </div>
      <MobileNav role={role} />
    </div>
  );
}
