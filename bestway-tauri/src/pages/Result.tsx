import { useEffect, useState } from "react";

type Props = {
  testTitle?: string | null;
  autoScore?: number | null;
  maxScore?: number | null;
  onBack: () => void;
  onHistory: () => void;
};

function ScoreRing({ score, max }: { score: number; max: number | null }) {
  const [shown, setShown] = useState(0);
  const pct = max && max > 0 ? Math.min(1, score / max) : null;

  useEffect(() => {
    let frame = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 900);
      setShown(Math.round(score * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const R = 52;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative mx-auto h-36 w-36">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
        {pct != null && (
          <circle
            cx="64" cy="64" r={R} fill="none"
            stroke="url(#scoreGrad)" strokeWidth="12" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
          />
        )}
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38c765" />
            <stop offset="100%" stopColor="#4cc9f0" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <p className="text-3xl font-black text-white">{shown}</p>
          {max != null && <p className="text-[11px] text-white/40">/ {max} pts</p>}
        </div>
      </div>
    </div>
  );
}

export default function Result({ testTitle, autoScore, maxScore, onBack, onHistory }: Props) {
  const hasScore = autoScore !== null && autoScore !== undefined;
  return (
    <section>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300/70">
        submitted ✓
      </p>
      <h1 className="mt-1 text-2xl font-black tracking-tight">
        {testTitle ?? "Exam submitted"}
      </h1>

      <div className="mt-4 grid items-start gap-3 xl:grid-cols-2">
        <div className="card rounded-2xl p-6 text-center">
          {hasScore ? (
            <>
              <ScoreRing score={autoScore} max={maxScore ?? null} />
              <p className="mt-3 text-sm font-semibold text-white">Auto score (listening / reading)</p>
              <p className="mt-1 text-xs text-white/40">
                Writing & speaking need manual grading — the final total appears in History.
              </p>
            </>
          ) : (
            <>
              <p className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-400/10 text-2xl ring-1 ring-emerald-400/30">📨</p>
              <p className="mt-3 text-sm font-semibold text-white">Submitted for grading</p>
              <p className="mt-1 text-xs text-white/40">
                Writing / speaking answers are with your teacher now. Check History for the final score.
              </p>
            </>
          )}
        </div>

        <div className="card rounded-2xl p-6">
          <h2 className="text-sm font-bold text-white">What's next?</h2>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-white/50">
            <li className="flex gap-2">
              <span className="text-emerald-300">→</span>
              Open History to track grading progress and final totals.
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-300">→</span>
              Head back to Exams to start your next assigned test.
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-300">→</span>
              Stay online — scores sync automatically when teachers finish grading.
            </li>
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={onHistory} className="btn-brand rounded-xl px-4 py-2.5 text-sm font-bold">
              View history
            </button>
            <button onClick={onBack} className="btn-ghost rounded-xl px-4 py-2.5 text-sm text-white">
              Back to exams
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
