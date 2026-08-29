"use client";

import * as React from "react";
import { Award, Clock, Headphones, Play, ScrollText, Trophy } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

type DemoQuestion = {
  id: string;
  number: number;
  prompt: string;
  correctAnswer: string | null;
  section: string;
  maxScore: number;
  type: string;
  options: string[] | null;
};

const FALLBACK_QUESTIONS: DemoQuestion[] = [
  { id: "q1", number: 1, prompt: "Type of dream mentioned at the start:", correctAnswer: "lucid", section: "listening", maxScore: 1, type: "short_answer", options: null },
  { id: "q2", number: 2, prompt: "Number of participants in the study:", correctAnswer: "12", section: "listening", maxScore: 1, type: "short_answer", options: null },
  { id: "q3", number: 3, prompt: "Age range of participants:", correctAnswer: "18-25", section: "listening", maxScore: 1, type: "short_answer", options: null },
  { id: "q4", number: 4, prompt: "Time the dream occurs (one word):", correctAnswer: "morning", section: "listening", maxScore: 1, type: "short_answer", options: null },
  { id: "q5", number: 5, prompt: "Place where the dream was discussed:", correctAnswer: "library", section: "listening", maxScore: 1, type: "short_answer", options: null },
  { id: "q6", number: 6, prompt: "Colour associated with calm:", correctAnswer: "blue", section: "listening", maxScore: 1, type: "short_answer", options: null },
  { id: "q7", number: 7, prompt: "Number of nights recorded:", correctAnswer: "seven", section: "listening", maxScore: 1, type: "short_answer", options: null },
  { id: "q8", number: 8, prompt: "Surname of the researcher:", correctAnswer: "Smith", section: "listening", maxScore: 1, type: "short_answer", options: null },
  { id: "q9", number: 9, prompt: "Day of the week for follow-up:", correctAnswer: "Monday", section: "listening", maxScore: 1, type: "short_answer", options: null },
  { id: "q10", number: 10, prompt: "Duration in minutes:", correctAnswer: "twenty", section: "listening", maxScore: 1, type: "short_answer", options: null },
];

const AUDIOSCRIPT = `Narrator: Welcome to the Dream Study interview. Today we talk about lucid dreams — dreams where you know you are dreaming.
Researcher Smith: We recruited 12 participants, aged 18-25. They reported dreams mostly in the morning, often after meeting in the library.
Narrator: Participants described colours — blue was linked to calm. Over seven nights they noted their dreams. The follow-up is on Monday and lasts twenty minutes.
`;

/** Normalize backend questions to DemoQuestion */
function toDemoQuestions(
  input: { id: string; prompt: string; correctAnswer?: string | null; section?: string; type?: string; maxScore?: number; options?: string[] | null }[] | null | undefined,
): DemoQuestion[] {
  if (!input || input.length === 0) return FALLBACK_QUESTIONS;
  return input.map((q, idx) => ({
    id: q.id,
    number: idx + 1,
    prompt: q.prompt,
    correctAnswer: q.correctAnswer ?? null,
    section: q.section ?? "listening",
    maxScore: q.maxScore ?? 1,
    type: q.type ?? "short_answer",
    options: q.options ?? null,
  }));
}

export default function DemoRunner({
  testId,
  title,
  durationMinutes,
  initialQuestions,
}: {
  testId: string;
  title: string;
  durationMinutes?: number | null;
  initialQuestions?: { id: string; prompt: string; correctAnswer?: string | null; section?: string; type?: string; maxScore?: number; options?: string[] | null }[] | null;
}) {
  const t = useTranslations("marketing");
  const tc = useTranslations("tests");
  const tCommon = useTranslations("common");

  const questions = React.useMemo(() => toDemoQuestions(initialQuestions), [initialQuestions]);
  const duration = durationMinutes && durationMinutes > 0 ? durationMinutes : 10;

  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [submitted, setSubmitted] = React.useState(false);
  const [score, setScore] = React.useState<{ total: number; max: number; perSection: Record<string, { score: number; max: number }> } | null>(null);
  const [remaining, setRemaining] = React.useState(duration * 60);
  const [showResult, setShowResult] = React.useState(false);

  // Timer — counts down from duration
  React.useEffect(() => {
    if (submitted) return;
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [submitted]);

  // Auto-submit when time is up
  React.useEffect(() => {
    if (remaining === 0 && !submitted) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  const answeredCount = React.useMemo(
    () => questions.filter((q) => (answers[q.id] ?? "").trim().length > 0).length,
    [answers, questions],
  );
  const progress = Math.round((answeredCount / questions.length) * 100);

  function normalizeAnswer(v: string) {
    return v.trim().toLowerCase();
  }

  function handleSubmit() {
    let total = 0;
    let max = 0;
    const perSection: Record<string, { score: number; max: number }> = {};
    for (const q of questions) {
      const expected = q.correctAnswer ? normalizeAnswer(q.correctAnswer) : null;
      const given = normalizeAnswer(answers[q.id] ?? "");
      const isCorrect = expected !== null && given.length > 0 && given === expected;
      const s = isCorrect ? q.maxScore : 0;
      total += s;
      max += q.maxScore;
      if (!perSection[q.section]) perSection[q.section] = { score: 0, max: 0 };
      perSection[q.section].score += s;
      perSection[q.section].max += q.maxScore;
    }
    const result = { total, max, perSection };
    setScore(result);
    setSubmitted(true);
    setShowResult(true);
    try {
      localStorage.setItem(`demo-result-${testId}`, JSON.stringify({ ...result, answers, date: new Date().toISOString(), title }));
    } catch {}
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="line-clamp-2 text-lg font-bold tracking-tight text-fg sm:text-xl">{title}</h1>
          <p className="mt-1 text-xs text-fg-muted">
            {questions.length} {tc("questions")} · {duration} {tc("minutes")} · {t("demoOneWordHint")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-sm font-semibold tabular-nums",
              remaining < 60 ? "bg-danger-bg text-danger" : "bg-bg-subtle text-fg",
            )}
          >
            <Clock className="size-4" />
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </span>
          <Badge variant="neutral">
            {answeredCount}/{questions.length} {tc("answered")}
          </Badge>
          {!submitted ? (
            <Button size="sm" onClick={() => { if (confirm(t("demoSubmitConfirm"))) handleSubmit(); }}>
              <Trophy className="size-4" />
              {t("demoSubmit")}
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setShowResult((v) => !v)}>
              <Award className="size-4" />
              {t("demoScores")}
            </Button>
          )}
        </div>
      </Card>

      {/* Progress bar */}
      <div className="h-1.5 overflow-hidden rounded-full bg-bg-subtle">
        <div
          className="h-full bg-brand transition-all duration-300"
          style={{ width: `${progress}%` }}
          aria-hidden
        />
      </div>

      {/* Main grid: left audio, right questions */}
      <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
        {/* Left — audio */}
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-brand-subtle text-brand-subtle-fg">
              <Headphones className="size-4" />
            </span>
            <span className="text-sm font-semibold text-fg">PART 1</span>
            <Badge variant="neutral">Listening</Badge>
          </div>

          <div className="rounded-[10px] border border-border bg-bg-subtle p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-fg-muted">
              <Play className="size-3.5" />
              Audio — demo preview
            </div>
            <audio controls className="mt-3 w-full" preload="none">
              {/* Dummy audio — browser will show controls even if file not found */}
              <source src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" type="audio/mpeg" />
              Your browser does not support the audio element.
            </audio>
            <p className="mt-2 text-xs text-fg-subtle">
              {t("demoTryHint")}
            </p>
          </div>

          <details className="group mt-4 rounded-[10px] border border-border bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-fg hover:bg-surface-hover">
              <span className="inline-flex items-center gap-2">
                <ScrollText className="size-4 text-fg-muted" />
                {t("demoAudioscript")}
              </span>
              <span className="text-xs text-fg-subtle group-open:hidden">+</span>
              <span className="hidden text-xs text-fg-subtle group-open:inline">−</span>
            </summary>
            <div className="border-t border-border px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-fg-muted">
              {AUDIOSCRIPT}
            </div>
          </details>

          <div className="mt-4 rounded-[10px] bg-bg-subtle p-3 text-xs leading-relaxed text-fg-muted">
            <p className="font-medium text-fg">Questions 1–{questions.length}</p>
            <p className="mt-1">{t("demoInstructions")}</p>
          </div>
        </Card>

        {/* Right — questions */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-fg">
              {t("demoInstructions")}
            </h2>
            <Badge variant="neutral">{t("demoOneWordHint")}</Badge>
          </div>

          <div className="space-y-3">
            {questions.map((q) => {
              const value = answers[q.id] ?? "";
              const isShort = q.type === "short_answer" || !q.options || q.options.length === 0;
              return (
                <div key={q.id} className="flex items-start gap-3 rounded-[10px] border border-border bg-surface p-3">
                  <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-xs font-bold text-brand-subtle-fg">
                    {q.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-relaxed text-fg">{q.prompt}</p>
                    <div className="mt-2">
                      {q.options && q.options.length > 0 ? (
                        <div className="space-y-1.5">
                          {q.options.map((opt, i) => (
                            <label
                              key={i}
                              className={cn(
                                "flex cursor-pointer items-center gap-2 rounded-[8px] border px-3 py-2 text-sm transition-colors",
                                value === opt ? "border-brand bg-brand-subtle/40 text-fg" : "border-border hover:bg-surface-hover",
                              )}
                            >
                              <input
                                type="radio"
                                name={q.id}
                                checked={value === opt}
                                onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                                className="accent-brand"
                                disabled={submitted}
                              />
                              {opt}
                            </label>
                          ))}
                        </div>
                      ) : isShort ? (
                        <Input
                          value={value}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                          placeholder={t("demoOneWordHint")}
                          disabled={submitted}
                          aria-label={`Answer ${q.number}`}
                        />
                      ) : (
                        <Input
                          value={value}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                          placeholder={tCommon("loading") as string}
                          disabled={submitted}
                        />
                      )}
                    </div>
                    {submitted && q.correctAnswer && (
                      <p className={cn("mt-1.5 text-xs", normalizeAnswer(value) === normalizeAnswer(q.correctAnswer) ? "text-success" : "text-danger")}>
                        {normalizeAnswer(value) === normalizeAnswer(q.correctAnswer) ? tc("correct") : tc("incorrect")} · {tc("correctAnswer")}: {q.correctAnswer}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {!submitted && (
            <div className="mt-6 flex justify-end">
              <Button onClick={() => { if (confirm(t("demoSubmitConfirm"))) handleSubmit(); }}>
                {t("demoSubmit")} · {answeredCount}/{questions.length}
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Bottom nav — Scores, 1 2 3 4, Reading */}
      <div className="sticky bottom-4 z-10">
        <Card className="flex items-center justify-between gap-2 p-2 shadow-md">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => submitted && setShowResult((v) => !v)}
              className={cn(
                "rounded-[8px] px-3 py-2 text-xs font-semibold transition-colors",
                submitted ? "bg-brand text-brand-fg" : "bg-bg-subtle text-fg-muted cursor-default",
              )}
            >
              {t("demoScores")}
            </button>
            <span className="hidden h-6 w-px bg-border sm:block" aria-hidden />
            <div className="hidden items-center gap-1 sm:flex">
              {[1, 2, 3, 4].map((n) => (
                <span
                  key={n}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full border text-xs font-medium",
                    n === 1 ? "border-brand bg-brand-subtle text-brand-subtle-fg" : "border-border bg-surface text-fg-muted",
                  )}
                >
                  {n}
                </span>
              ))}
              <Badge variant="neutral" className="ml-1 hidden sm:inline-flex">
                Reading
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-fg-muted sm:inline">
              {progress}% · {answeredCount}/{questions.length}
            </span>
            {!submitted ? (
              <Button size="sm" onClick={() => { if (confirm(t("demoSubmitConfirm"))) handleSubmit(); }}>
                {t("demoSubmit")}
              </Button>
            ) : (
              <span className="text-xs font-medium text-success">{t("demoSaveLocal")} ✓</span>
            )}
          </div>
        </Card>
      </div>

      {/* Result view */}
      {submitted && showResult && score && (
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-fg">{t("demoResultTitle")}</h3>
              <p className="mt-1 text-sm text-fg-muted">{t("demoResultSubtitle")}</p>
            </div>
            <Badge variant="success" className="text-sm">
              {t("demoSaveLocal")}
            </Badge>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[12px] border border-border bg-bg-subtle p-4 text-center">
              <p className="text-xs tracking-wide text-fg-subtle uppercase">{t("demoTotalScore")}</p>
              <p className="mt-2 text-3xl font-bold text-fg">
                {score.total} <span className="text-lg font-medium text-fg-muted">/ {score.max}</span>
              </p>
              <p className="mt-1 text-xs text-fg-muted">
                {Math.round((score.total / Math.max(1, score.max)) * 100)}%
              </p>
            </div>

            <div className="rounded-[12px] border border-border bg-surface p-4 sm:col-span-2">
              <p className="text-xs tracking-wide text-fg-subtle uppercase">{t("demoPerSection")}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {Object.entries(score.perSection).map(([section, v]) => (
                  <div key={section} className="rounded-[8px] bg-bg-subtle px-3 py-2">
                    <p className="text-xs font-medium text-fg-muted capitalize">{section}</p>
                    <p className="text-sm font-semibold text-fg">
                      {v.score} / {v.max}
                    </p>
                    <div className="mt-1 h-1 rounded-full bg-border">
                      <div
                        className="h-full rounded-full bg-brand transition-all"
                        style={{ width: `${Math.round((v.score / Math.max(1, v.max)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[12px] border border-brand/20 bg-brand-subtle/30 p-4">
            <p className="text-sm font-semibold text-fg">{t("demoLoginCta")}</p>
            <p className="mt-1 text-sm text-fg-muted">{t("demoLoginCtaHint")}</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link
                href={`/login?next=${encodeURIComponent(`/demo/${testId}`)}`}
                className={cn(buttonVariants({ size: "lg" }), "flex-1 justify-center")}
              >
                {t("demoLogin")}
              </Link>
              <Link
                href={`/register?next=${encodeURIComponent(`/demo/${testId}`)}`}
                className={cn(buttonVariants({ size: "lg", variant: "outline" }), "flex-1 justify-center")}
              >
                {t("demoRegister")}
              </Link>
            </div>
            <p className="mt-3 text-center text-xs text-fg-subtle">
              {t("demoNeedLogin")}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
