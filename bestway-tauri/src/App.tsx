import { useEffect, useState } from "react";
import Login from "@/pages/Login";
import Exams from "@/pages/Exams";
import Runner from "@/pages/Runner";
import Locked from "@/pages/Locked";
import Result from "@/pages/Result";
import StatusBar from "@/components/StatusBar";
import BatteryIndicator from "@/components/BatteryIndicator";
import ClickSpark from "@/components/ClickSpark";
import CursorTrail from "@/components/CursorTrail";
import { clearSession, getAccessToken, getRefreshToken, logout, me, refresh } from "@/lib/api";

export type Route = "login" | "exams" | "runner" | "locked" | "result";

export default function App() {
  const [route, setRoute] = useState<Route>("login");
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);

  // Restore persisted session (api.ts stores tokens in localStorage).
  // Without this, every reload forced re-login even with valid tokens.
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        if (!getAccessToken() && getRefreshToken()) {
          try {
            await refresh();
          } catch {
            clearSession();
          }
        }
        if (getAccessToken()) {
          const profile = await me();
          if (!dead) {
            if (profile?.user?.role === "student" && profile.user.id) {
              setStudentId(profile.user.id);
              setStudentName(
                typeof profile.user.name === "string" ? profile.user.name : null,
              );
              setRoute("exams");
            } else {
              clearSession();
            }
          }
        }
      } catch {
        // Offline / expired — stay on login; request() already tried refresh.
        try {
          if (!getAccessToken()) clearSession();
        } catch {
          /* ignore */
        }
      } finally {
        if (!dead) setRestoring(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, []);

  const navigate = (next: Route) => setRoute(next);

  const handleLogin = (student: { id: string; name: string | null }) => {
    setStudentId(student.id);
    setStudentName(student.name);
    setRoute("exams");
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      clearSession();
      setStudentId(null);
      setStudentName(null);
      setRoute("login");
    }
  };

  // Student-only gate: force login when unauthenticated.
  const activeRoute: Route = studentId ? route : "login";

  if (restoring) {
    return (
      <div className="app-bg app-grid min-h-screen pb-14 text-white">
        <main className="mx-auto w-full max-w-3xl p-4 pt-10">
          <p className="text-center text-sm text-white/50">Restoring session…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="app-bg app-grid min-h-screen pb-14 text-white">
      <ClickSpark sparkColor="#38c765" sparkSize={10} sparkRadius={22} sparkCount={8} duration={420}>
        <CursorTrail sparkColor="#38c765" />
        <main className="mx-auto w-full max-w-3xl p-4 pt-10">
          {activeRoute === "login" && <Login onLogin={handleLogin} />}
          {activeRoute === "exams" && <Exams onStart={() => navigate("runner")} />}
          {activeRoute === "runner" && (
            <Runner
              onLocked={() => navigate("locked")}
              onFinish={() => navigate("result")}
            />
          )}
          {activeRoute === "locked" && <Locked onBack={() => navigate("exams")} />}
          {activeRoute === "result" && <Result onBack={() => navigate("exams")} />}
        </main>
      </ClickSpark>
      <StatusBar
        sessionLabel={studentId ? (studentName ?? "Student") : "signed out"}
        onLogout={studentId ? handleLogout : undefined}
        rightSlot={<BatteryIndicator standalone={false} compact lang="uz" />}
      />
    </div>
  );
}
