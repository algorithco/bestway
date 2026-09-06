import { useEffect, useMemo, useRef, useState } from "react";
import { getVolume, setVolume, VOLUME_EVENT } from "@/lib/volume";
import { getConfirmBeforeSubmit } from "@/lib/exam-prefs";
import { resolveAudioUrl, saveAnswer, submitAttempt } from "@/lib/tests";
import type { RunnerQuestion, StartResult, TestListItem } from "@/lib/tests";

type Props = {
  test: TestListItem;
  start: StartResult;
  onLocked: () => void;
  onExit: () => void;
  onFinish: (score: { autoScore: number | null }) => void;
};

interface PartItem {
  q: RunnerQuestion;
  num: number;
}

interface Part {
  key: string;
  section: string;
  audioUrl: string | null;
  instructions: string | null;
  passageText: string | null;
  items: PartItem[];
}

function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(r).padStart(2, "0")}`;
}

function friendlyError(e: unknown): string {
  if (typeof e === "object" && e !== null) {
    const { code, message } = e as { code?: unknown; message?: unknown };
    if (typeof message === "string" && message) {
      return typeof code === "string" && code ? `${message} (${code})` : message;
    }
  }
  if (e instanceof Error && e.message) return e.message;
  return "Request failed. Check connection.";
}

/** Group consecutive questions sharing section + audio into exam parts. */
function buildParts(questions: RunnerQuestion[]): Part[] {
  const parts: Part[] = [];
  questions.forEach((q, i) => {
    const audioKey = q.audioUrl ?? (q.hasAudio ? `flag:${q.id}` : "none");
    const key = `${q.section}::${audioKey}`;
    const last = parts[parts.length - 1];
    if (last && last.key === key) {
      last.items.push({ q, num: i + 1 });
      if (!last.instructions && q.instructions) last.instructions = q.instructions;
      if (!last.passageText && q.passageText) last.passageText = q.passageText;
    } else {
      parts.push({
        key,
        section: q.section,
        audioUrl: resolveAudioUrl(q.audioUrl),
        instructions: q.instructions ?? null,
        passageText: q.passageText ?? null,
        items: [{ q, num: i + 1 }],
      });
    }
  });
  return parts;
}

/** Large exam-style audio player: play/pause, seek, time, volume, rate. */
function AudioPlayer({ src, title }: { src: string; title: string }) {
  const elRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [vol, setVol] = useState(() => getVolume());
  const [rate, setRate] = useState(1);

  // Fresh element per source (key) — reset state and apply volume/rate.
  useEffect(() => {
    setPlaying(false);
    setCur(0);
    setDur(0);
    const el = elRef.current;
    if (el) {
      el.pause();
      el.volume = getVolume() / 100;
      el.playbackRate = 1;
    }
    setRate(1);
  }, [src]);

  useEffect(() => {
    const onVol = (e: Event) => setVol((e as CustomEvent<number>).detail);
    window.addEventListener(VOLUME_EVENT, onVol);
    return () => window.removeEventListener(VOLUME_EVENT, onVol);
  }, []);

  useEffect(() => {
    if (elRef.current) elRef.current.playbackRate = rate;
  }, [rate, src]);

  const toggle = () => {
    const el = elRef.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => setPlaying(false));
    else el.pause();
  };

  const seek = (v: number) => {
    const el = elRef.current;
    if (!el) return;
    el.currentTime = Math.min(Math.max(0, v), dur || 0);
    setCur(el.currentTime);
  };

  const changeVol = (v: number) => {
    setVol(v);
    setVolume(v);
  };

  const pct = dur > 0 ? Math.min(100, (cur / dur) * 100) : 0;

  return (
    <div className="rounded-2xl bg-black/40 p-4 ring-1 ring-white/10">
      <audio
        key={src}
        ref={elRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          setDur(e.currentTarget.duration || 0);
          e.currentTarget.volume = getVolume() / 100;
        }}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause audio" : "Play audio"}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#19D36B] text-black shadow-[0_0_24px_rgba(25,211,107,0.35)] transition hover:brightness-110"
        >
          {playing ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M7 4.5v15l13-7.5-13-7.5z" />
            </svg>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-white/80">{title}</p>
          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-white/45">
            {fmtTime(cur)} / {dur > 0 ? fmtTime(dur) : "–:––"}
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-1.5 text-white/50" title="Playback speed">
          <span className="text-[10px] font-bold uppercase">Speed</span>
          <select
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="rounded-lg bg-white/5 px-1.5 py-1 font-mono text-[11px] text-white ring-1 ring-white/10 outline-none"
          >
            <option value={0.75}>0.75×</option>
            <option value={1}>1×</option>
            <option value={1.25}>1.25×</option>
            <option value={1.5}>1.5×</option>
          </select>
        </label>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(dur, 0.1)}
        step={0.1}
        value={Math.min(cur, dur || 0)}
        onChange={(e) => seek(Number(e.target.value))}
        aria-label="Seek"
        className="exam-range mt-3 w-full"
      />
      <div className="mt-2 flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          className="shrink-0 text-white/45">
          <path d="M11 5 6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        </svg>
        <input
          type="range"
          min={0}
          max={100}
          value={vol}
          onChange={(e) => changeVol(Number(e.target.value))}
          aria-label="Volume"
          className="exam-range w-32"
        />
        <span className="font-mono text-[11px] tabular-nums text-white/45">{vol}%</span>
        <div className="ml-auto h-1.5 w-24 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
          <div className="h-full rounded-full bg-[#19D36B] transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

export default function Runner({ test, start, onLocked, onExit, onFinish }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>(
    () => start.savedAnswers ?? {},
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const parts = useMemo(() => buildParts(start.questions), [start.questions]);
  const [partIdx, setPartIdx] = useState(0);
  const [currentNum, setCurrentNum] = useState(1);

  const rightScrollRef = useRef<HTMLDivElement | null>(null);
  const qRefs = useRef(new Map<number, HTMLElement>());

  const total = start.questions.length;
  const answered = useMemo(
    () => start.questions.filter((q) => (answers[q.id] ?? "").trim().length > 0).length,
    [answers, start.questions],
  );
  const progress = total === 0 ? 0 : Math.round((answered / total) * 100);

  const deadline = useMemo(() => {
    if (test.durationMinutes == null || test.durationMinutes <= 0) return null;
    return new Date(start.startedAt).getTime() + test.durationMinutes * 60_000;
  }, [test.durationMinutes, start.startedAt]);

  useEffect(() => {
    if (deadline == null) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [deadline]);

  const remaining = deadline == null ? null : deadline - now;
  const timeUp = remaining != null && remaining <= 0;

  const activePart = parts[partIdx] ?? null;
  const partFirst = activePart?.items[0]?.num ?? 1;
  const partLast = activePart?.items[activePart.items.length - 1]?.num ?? total;

  function scrollToNum(num: number) {
    setCurrentNum(num);
    requestAnimationFrame(() => {
      qRefs.current.get(num)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function gotoPart(idx: number, num?: number) {
    const clamped = Math.min(Math.max(0, idx), parts.length - 1);
    setPartIdx(clamped);
    const target = num ?? parts[clamped]?.items[0]?.num ?? 1;
    if (num == null) rightScrollRef.current?.scrollTo({ top: 0 });
    scrollToNum(target);
  }

  function stepQuestion(dir: -1 | 1) {
    const next = Math.min(total, Math.max(1, currentNum + dir));
    const owner = parts.findIndex((p) => p.items.some((it) => it.num === next));
    if (owner !== -1 && owner !== partIdx) setPartIdx(owner);
    scrollToNum(next);
  }

  async function handleAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setSavingId(questionId);
    setError(null);
    try {
      await saveAnswer(start.attemptId, questionId, value);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSavingId((cur) => (cur === questionId ? null : cur));
    }
  }

  async function handleSubmit() {
    if (
      getConfirmBeforeSubmit() &&
      !confirm(`Submit ${answered}/${total} answered? Unanswered count as 0.`)
    ) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await submitAttempt(start.attemptId);
      onFinish({ autoScore: res?.autoScore ?? null });
    } catch (e) {
      setError(friendlyError(e));
      setSubmitting(false);
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      {/* Compact exam header */}
      <header className="flex shrink-0 items-center gap-4 border-b border-white/10 bg-[#101512]/90 px-5 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 rounded-lg bg-[#19D36B]/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#19D36B] ring-1 ring-[#19D36B]/30">
            IELTS Listening
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-bold text-white">{test.title}</p>
            <p className="text-[11px] text-[#8D9891]">
              {activePart
                ? `Part ${partIdx + 1}/${parts.length} · ${activePart.section} · Q${partFirst}–Q${partLast}`
                : `${total} questions`}
            </p>
          </div>
        </div>
        <div className="mx-auto hidden w-full max-w-xs items-center gap-2 xl:flex">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#19D36B] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="font-mono text-[11px] tabular-nums text-white/55">{progress}%</span>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {deadline != null && (
            <span
              className={`rounded-lg px-2.5 py-1 font-mono text-xs font-bold tabular-nums ring-1 ${
                timeUp
                  ? "bg-red-500/15 text-red-300 ring-red-500/40"
                  : (remaining ?? 0) < 5 * 60_000
                    ? "bg-amber-400/10 text-amber-200 ring-amber-400/30"
                    : "bg-white/5 text-white/70 ring-white/10"
              }`}
              title="Time remaining"
            >
              ⏱ {remaining != null ? fmtTime(remaining / 1000) : "–:––"}
            </span>
          )}
          <span className="rounded-lg bg-white/5 px-2.5 py-1 font-mono text-xs tabular-nums text-white/70 ring-1 ring-white/10">
            {answered}/{total}
          </span>
          <button
            type="button"
            onClick={onExit}
            title="Leave exam (answers are saved)"
            className="btn-ghost rounded-lg px-2.5 py-1 text-xs text-white/60 hover:text-white"
          >
            ✕ Exit
          </button>
        </div>
      </header>

      {timeUp && (
        <div className="shrink-0 border-b border-red-500/30 bg-red-500/10 px-5 py-2 text-center text-xs font-semibold text-red-200">
          Time is up — press Submit now. Your saved answers are safe.
        </div>
      )}

      {/* Two-panel workspace */}
      <div className="grid min-h-0 flex-1 grid-cols-[45%_55%]">
        {/* LEFT — audio / material */}
        <aside className="flex min-h-0 min-w-0 flex-col border-r border-white/10 bg-[#0E1310]">
          <div className="shrink-0 border-b border-white/[0.07] px-5 pb-3 pt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#19D36B]/80">
              Part {partIdx + 1} of {parts.length}
            </p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-white">
              {activePart ? `${capitalize(activePart.section)} · Questions ${partFirst}–${partLast}` : "Material"}
            </h2>
            {/* Part tabs */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {parts.map((p, i) => {
                const done = p.items.filter((it) => (answers[it.q.id] ?? "").trim()).length;
                const active = i === partIdx;
                return (
                  <button
                    key={p.key + i}
                    type="button"
                    onClick={() => gotoPart(i)}
                    aria-current={active ? "true" : undefined}
                    title={`${p.section} · Q${p.items[0]?.num}–Q${p.items[p.items.length - 1]?.num} · ${done}/${p.items.length} answered`}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold ring-1 transition ${
                      active
                        ? "bg-[#19D36B]/15 text-[#19D36B] ring-[#19D36B]/40"
                        : "bg-white/[0.04] text-white/50 ring-white/10 hover:text-white"
                    }`}
                  >
                    P{i + 1} · {done}/{p.items.length}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {activePart?.audioUrl ? (
              <AudioPlayer src={activePart.audioUrl} title={`${test.title} — Part ${partIdx + 1} audio`} />
            ) : (
              <div className="rounded-2xl bg-black/30 p-4 text-xs text-[#8D9891] ring-1 ring-white/10">
                No audio attached to this part. Answer from the material below.
              </div>
            )}
            {activePart?.instructions && (
              <div className="mt-3 rounded-xl bg-[#19D36B]/[0.06] px-3.5 py-2.5 text-xs leading-relaxed text-emerald-100/90 ring-1 ring-[#19D36B]/20">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#19D36B]/80">Instructions</p>
                <p className="mt-1 whitespace-pre-wrap">{activePart.instructions}</p>
              </div>
            )}
            {activePart?.passageText && (
              <div className="mt-3 rounded-xl bg-black/30 px-3.5 py-2.5 ring-1 ring-white/10">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Material</p>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-white/70">
                  {activePart.passageText}
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* RIGHT — questions */}
        <div className="flex min-h-0 min-w-0 flex-col bg-[#0B0F0D]">
          <div className="shrink-0 border-b border-white/[0.07] px-5 pb-3 pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-bold text-white">
                Questions {partFirst}–{partLast}
              </h2>
              <p className="font-mono text-[11px] tabular-nums text-white/40">
                {activePart?.items.filter((it) => (answers[it.q.id] ?? "").trim()).length ?? 0}/
                {activePart?.items.length ?? 0} answered in this part
              </p>
            </div>
          </div>
          <div ref={rightScrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <ol className="mx-auto w-full max-w-3xl space-y-3">
              {activePart?.items.map(({ q, num }) => {
                const done = (answers[q.id] ?? "").trim().length > 0;
                const hasOptions = Array.isArray(q.options) && q.options.length > 0;
                const isLong = q.type === "essay" || q.type === "speaking_prompt";
                return (
                  <li
                    key={q.id}
                    ref={(el) => {
                      if (el) qRefs.current.set(num, el);
                      else qRefs.current.delete(num);
                    }}
                    className={`scroll-mt-2 rounded-2xl bg-[#111713] p-4 ring-1 transition ${
                      currentNum === num ? "ring-[#19D36B]/45" : "ring-white/10"
                    }`}
                    onClick={() => setCurrentNum(num)}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-black ${
                          done ? "bg-[#19D36B] text-black" : "bg-white/10 text-white/55"
                        }`}
                      >
                        {done ? "✓" : num}
                      </span>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#626B65]">
                        Q{num} · {q.section} · {q.type.replace("_", " ")} · {q.maxScore} pt
                      </p>
                    </div>
                    <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-[#F2F5F3]">
                      {q.prompt}
                    </p>
                    {hasOptions ? (
                      <ul className="mt-3 space-y-1.5">
                        {q.options!.map((o, oi) => {
                          const selected = answers[q.id] === o;
                          return (
                            <li key={oi}>
                              <button
                                type="button"
                                onClick={() => void handleAnswer(q.id, o)}
                                aria-pressed={selected}
                                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] ring-1 transition ${
                                  selected
                                    ? "bg-[#19D36B]/12 text-white ring-[#19D36B]/50"
                                    : "bg-black/30 text-white/70 ring-white/10 hover:border-white/25 hover:ring-white/25"
                                }`}
                              >
                                <span
                                  className={`grid size-5 shrink-0 place-items-center rounded-full border text-[11px] font-bold ${
                                    selected
                                      ? "border-[#19D36B] bg-[#19D36B] text-black"
                                      : "border-white/25 text-white/50"
                                  }`}
                                >
                                  {selected ? "✓" : String.fromCharCode(65 + oi)}
                                </span>
                                <span>{o}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : isLong ? (
                      <textarea
                        value={answers[q.id] ?? ""}
                        onChange={(e) => void handleAnswer(q.id, e.target.value)}
                        placeholder="Write your answer here…"
                        rows={5}
                        className="field mt-3 min-h-28 w-full rounded-xl px-3 py-2.5 text-sm leading-relaxed"
                      />
                    ) : (
                      <input
                        value={answers[q.id] ?? ""}
                        onChange={(e) => void handleAnswer(q.id, e.target.value)}
                        placeholder="Type your answer…"
                        autoComplete="off"
                        spellCheck={false}
                        className="field mt-3 w-full rounded-xl px-3 py-2.5 font-mono text-sm"
                      />
                    )}
                    {savingId === q.id && (
                      <p className="mt-1.5 text-[11px] text-white/30">Saving…</p>
                    )}
                  </li>
                );
              })}
            </ol>
            {error && (
              <p role="alert" className="mx-auto mt-3 w-full max-w-3xl rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom exam control strip */}
      <footer className="flex shrink-0 items-center gap-2 border-t border-white/10 bg-[#101512]/95 px-4 py-2">
        <button
          type="button"
          onClick={() => stepQuestion(-1)}
          disabled={currentNum <= 1}
          className="btn-ghost shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          ← Prev
        </button>
        <button
          type="button"
          onClick={() => stepQuestion(1)}
          disabled={currentNum >= total}
          className="btn-ghost shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          Next →
        </button>
        <span className="hidden shrink-0 font-mono text-[11px] tabular-nums text-white/45 md:inline">
          Q{currentNum}/{total}
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 py-0.5" role="navigation" aria-label="Questions">
          {start.questions.map((q, i) => {
            const n = i + 1;
            const done = (answers[q.id] ?? "").trim().length > 0;
            const cur = n === currentNum;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => {
                  const owner = parts.findIndex((p) => p.items.some((it) => it.num === n));
                  if (owner !== -1 && owner !== partIdx) setPartIdx(owner);
                  scrollToNum(n);
                }}
                title={`Question ${n}${done ? " (answered)" : ""}`}
                aria-label={`Question ${n}${done ? ", answered" : ""}`}
                aria-current={cur ? "true" : undefined}
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg font-mono text-[11px] font-bold ring-1 transition ${
                  cur
                    ? "bg-[#19D36B] text-black ring-[#19D36B]"
                    : done
                      ? "bg-[#19D36B]/15 text-[#19D36B] ring-[#19D36B]/40 hover:bg-[#19D36B]/25"
                      : "bg-white/[0.05] text-white/45 ring-white/10 hover:text-white"
                }`}
              >
                {done && !cur ? "✓" : n}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onLocked}
          title="Simulate lock"
          className="hidden shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] text-white/35 hover:text-white lg:inline"
        >
          Lock
        </button>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting || total === 0}
          className="shrink-0 rounded-lg bg-[#19D36B] px-5 py-1.5 text-xs font-black text-black shadow-[0_0_20px_rgba(25,211,107,0.3)] transition hover:brightness-110 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : `Submit ${answered}/${total}`}
        </button>
      </footer>
    </section>
  );
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}
