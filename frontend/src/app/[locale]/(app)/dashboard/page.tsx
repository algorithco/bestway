import dynamic from "next/dynamic";
import { setRequestLocale } from "next-intl/server";
import { getSessionRole } from "@/lib/auth";

const AdminDashboard = dynamic(() => import("@/components/dashboard/admin-dashboard").then((m) => m.AdminDashboard), {
  loading: () => <div className="h-64 animate-pulse rounded-[12px] bg-border/40" />,
});
const TeacherDashboard = dynamic(() => import("@/components/dashboard/teacher-dashboard").then((m) => m.TeacherDashboard), {
  loading: () => <div className="h-64 animate-pulse rounded-[12px] bg-border/40" />,
});
const StudentDashboard = dynamic(() => import("@/components/dashboard/student-dashboard").then((m) => m.StudentDashboard), {
  loading: () => <div className="h-64 animate-pulse rounded-[12px] bg-border/40" />,
});
const ParentDashboard = dynamic(() => import("@/components/dashboard/parent-dashboard").then((m) => m.ParentDashboard), {
  loading: () => <div className="h-64 animate-pulse rounded-[12px] bg-border/40" />,
});

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const role = await getSessionRole();

  switch (role) {
    case "admin":
    case "super_admin":
      return <AdminDashboard />;
    case "teacher":
      return <TeacherDashboard />;
    case "student":
      return <StudentDashboard />;
    case "parent":
      return <ParentDashboard />;
    default:
      return null;
  }
}
