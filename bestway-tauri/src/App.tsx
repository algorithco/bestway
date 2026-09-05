import { useState } from "react";
import Login from "@/pages/Login";
import Exams from "@/pages/Exams";
import Runner from "@/pages/Runner";
import Locked from "@/pages/Locked";
import Result from "@/pages/Result";
import StatusBar from "@/components/StatusBar";
import BatteryIndicator from "@/components/BatteryIndicator";

export type Route = "login" | "exams" | "runner" | "locked" | "result";

export default function App() {
  const [route, setRoute] = useState<Route>("login");
  // Minimal student session gate (real auth owned elsewhere / via src/lib/api*).
  const [studentId, setStudentId] = useState<string | null>(null);

  const navigate = (next: Route) => setRoute(next);

  const handleLogin = (id: string) => {
    setStudentId(id);
    setRoute("exams");
  };

  // Student-only gate: force login when unauthenticated.
  const activeRoute: Route = studentId ? route : "login";

  return (
    <div className="min-h-screen bg-slate-50 pb-12 text-slate-900">
      <main className="mx-auto max-w-3xl p-4">
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
      <StatusBar
        sessionLabel={studentId ? `student:${studentId}` : "signed out"}
        rightSlot={<BatteryIndicator standalone={false} compact lang="uz" />}
      />
    </div>
  );
}
