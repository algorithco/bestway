import { useState } from "react";

type Props = {
  onLogin: (studentId: string) => void;
};

export default function Login({ onLogin }: Props) {
  const [studentId, setStudentId] = useState("");

  return (
    <section>
      <h1 className="text-xl font-semibold">Login</h1>
      <p className="mt-1 text-sm text-slate-500">
        Student-only. Online-only.
      </p>
      {/* TODO: wire to backend POST /v1/auth/login (tests+mock contract); online-only, no offline cache. */}
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (studentId.trim()) onLogin(studentId.trim());
        }}
      >
        <input
          className="flex-1 rounded border px-3 py-2"
          placeholder="Student ID"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
        />
        <button
          type="submit"
          className="rounded bg-blue-700 px-4 py-2 text-white"
        >
          Sign in
        </button>
      </form>
    </section>
  );
}
