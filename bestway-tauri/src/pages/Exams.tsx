import { useCallback, useEffect, useState } from "react";
import { listTests, startTest, type StartResult, type TestListItem } from "@/lib/tests";

type Props = {
  studentName: string | null;
  onStart: (test: TestListItem, start: StartResult) => void;
};

const TYPE_STYLE: Record<string, string> = {
  ielts: "bg-sky-400/10 text-sky-200 ring-sky-400/30",
  multilevel: "bg-violet-400/10 text-violet-200 ring-violet-400/30",
};

function Greeting({ name }: { name: string | null }) {
  const hour = new Date().getHours();
  const part = hour < 5 ? "Good night" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300/70">
        {part}{name ? `, ${name.split(" ")[0]}` : ""}
      </p>
      <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Ready for your exam?</h1>
      <p className="mt-1 text-sm text-white/50">
        Pick a test below. Listening audio plays inside the runner — set your volume first.
      </p>
    </div>
  );
}

export default function Exams({ studentName, onStart }: Props) {
  const [tests, setTests] = useState<TestListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await listTests();
      setTests(items);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleStart(test: TestListItem) {
    setStartingId(test.id);
    setStartError(null);
    try {
      const start = await startTest(test.id);
      onStart(test, start);
    } catch (e) {
      setStartError(`${test.title}: ${friendlyError(e)}`);
    } finally {
      setStartingId(null);
    }
  }

  return (
    <section>
      <div className="flex items-start justify-between gap-3">
        <Greeting name={studentName} />
        {!loading && (
          <button
            onClick={() => void load()}
            className="btn-ghost shrink-0 rounded-xl px-3 py-2 text-xs text-white"
            aria-label="Refresh exams"
          >
            ⟳ Refresh
          </button>
        )}
      </div>

      {!loading && !error && tests && tests.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <div className="card rounded-2xl p-3 text-center">
            <p className="text-xl font-black text-white">{tests.length}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-widest text-white/40">assigned</p>
          </div>
          <div className="card rounded-2xl p-3 text-center">
            <p className="text-xl font-black text-white">
              {tests.reduce((s, t) => s + t.questionCount, 0)}
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-widest text-white/40">questions</p>
          </div>
          <div className="card rounded-2xl p-3 text-center">
            <p className="text-xl font-black text-emerald-300">
              {tests.filter((t) => t.questionCount > 0).length}
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-widest text-white/40">ready</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="mt-4 space-y-3" aria-label="Loading exams">
          {[0, 1].map((i) => (
            <div key={i} className="card animate-pulse rounded-2xl p-5">
              <div className="h-4 w-1/2 rounded bg-white/10" />
              <div className="mt-2 h-3 w-1/4 rounded bg-white/5" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="card mt-4 rounded-2xl border border-red-500/30 p-5">
          <p className="text-sm font-medium text-red-300">Could not load exams</p>
          <p className="mt-1 text-xs text-white/60">{error}</p>
          <p className="mt-1 text-[11px] text-white/30">
            Check your internet connection and try again.
          </p>
          <button
            onClick={() => void load()}
            className="btn-brand mt-3 rounded-xl px-4 py-2 text-sm font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && tests && tests.length === 0 && (
        <div className="card mt-4 rounded-2xl p-6 text-center">
          <p className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/5 text-xl">🎯</p>
          <p className="mt-3 text-sm font-semibold text-white">No exams assigned yet</p>
          <p className="mx-auto mt-1 max-w-70 text-xs text-white/40">
            New tests appear here automatically once an admin creates an active test with
            questions. If one was just added in the web panel, make sure it is active and
            press Refresh.
          </p>
        </div>
      )}

      {!loading && !error && tests && tests.length > 0 && (
        <ul className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {tests.map((t, idx) => {
            const empty = t.questionCount === 0;
            return (
              <li
                key={t.id}
                className="card animate-rise group rounded-2xl p-5 transition hover:border-emerald-400/25"
                style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${TYPE_STYLE[t.type] ?? "bg-white/10 text-white/70 ring-white/20"}`}
                      >
                        {t.type}
                      </span>
                      {t.level && (
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/60 ring-1 ring-white/10">
                          {t.level}
                        </span>
                      )}
                      {t.isDemo && (
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/60 ring-1 ring-white/10">
                          demo
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 truncate text-base font-bold text-white">{t.title}</p>
                    <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-white/40">
                      {t.durationMinutes != null && <span>⏱ {t.durationMinutes} min</span>}
                      <span>❓ {t.questionCount} questions</span>
                    </p>
                    {t.sections?.length > 0 && (
                      <p className="mt-1.5 flex flex-wrap gap-1">
                        {t.sections.map((s) => (
                          <span
                            key={s}
                            className="rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] font-medium text-white/50 ring-1 ring-white/10"
                          >
                            {s}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => void handleStart(t)}
                    disabled={startingId !== null || empty}
                    className="btn-brand shrink-0 rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-50"
                  >
                    {startingId === t.id ? "Starting…" : empty ? "Empty" : "Start →"}
                  </button>
                </div>
                {empty && (
                  <p className="mt-2 text-[11px] text-amber-300/80">
                    This test has no questions yet — starting will fail (TEST_EMPTY) until an admin adds some.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {startError && (
        <p role="alert" className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {startError}
        </p>
      )}
    </section>
  );
}

function friendlyError(e: unknown): string {
  if (typeof e === "object" && e !== null) {
    const { code, message, status } = e as {
      code?: unknown;
      message?: unknown;
      status?: unknown;
    };
    if (typeof message === "string" && message) {
      return typeof code === "string" && code ? `${message} (${code})` : message;
    }
    if (typeof status === "number") return `Request failed: ${status}`;
  }
  if (e instanceof Error && e.message) return e.message;
  return "Request failed. Check connection.";
}
