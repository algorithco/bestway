"use client";

import * as React from "react";
import { ArrowLeft, Check, Download, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { useGradeMock } from "@/hooks/use-mock";
import { useMe } from "@/hooks/use-me";
import type { MockAttemptDetail, MockAttemptQuestion, MockSkill } from "@/lib/types";
import { cn } from "@/lib/utils";

const media = (path: string) => `/api/backend${path}`;
const MANUAL_SKILLS = new Set<MockSkill>(["writing", "speaking"]);

export function MockResultView({ attempt }: { attempt: MockAttemptDetail }) {
  const t = useTranslations("mock");
  const { data: me } = useMe();
  const role = me?.user.role;
  const isStaff = role === "teacher" || role === "admin" || role === "super_admin";
  const grade = useGradeMock(attempt.id);

  const isIelts = attempt.examType !== "multilevel";
  const completed = attempt.status === "completed";

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/mock"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" />
        {t("title")}
      </Link>

      {/* Natija sarlavhasi */}
      <Card className="p-6 text-center">
        <p className="text-sm text-fg-muted">
          {attempt.examTitle}
          {isStaff && attempt.studentName ? ` · ${attempt.studentName}` : ""}
        </p>
        <div className="mt-2 flex items-center justify-center">
          <Badge variant={completed ? "success" : "warning"}>{t(`status.${attempt.status}`)}</Badge>
        </div>

        {completed && (
          <div className="mt-4">
            {isIelts ? (
              <>
                <p className="text-xs tracking-wide text-fg-subtle uppercase">{t("overallBand")}</p>
                <p className="bg-gradient-to-br from-brand to-accent bg-clip-text text-5xl font-bold text-transparent tabular-nums">
                  {attempt.overallBand ?? "—"}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs tracking-wide text-fg-subtle uppercase">{t("cefrLevel")}</p>
                <p className="text-5xl font-bold text-brand">{attempt.cefrLevel ?? "—"}</p>
              </>
            )}
          </div>
        )}

        {/* Bo'lim ballari */}
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {attempt.sections.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-[8px] border border-border bg-bg-subtle px-3 py-2"
            >
              <span className="text-sm font-medium text-fg">{t(`skills.${s.skill}`)}</span>
              <span className="text-sm text-fg-muted tabular-nums">
                {s.band != null && isIelts ? (
                  <span className="font-bold text-brand">{s.band}</span>
                ) : s.score != null && s.max != null ? (
                  `${s.score}/${s.max}`
                ) : (
                  t("awaitingGrade")
                )}
              </span>
            </div>
          ))}
        </div>

        {completed && (
          <a
            href={media(`/mock/attempts/${attempt.id}/certificate`)}
            className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            <Download className="size-4" />
            {t("certificate")}
          </a>
        )}
      </Card>

      {/* Savollar tahlili */}
      <div className="mt-6 space-y-4">
        {attempt.sections.map((s) => {
          const canGrade = isStaff && MANUAL_SKILLS.has(s.skill);
          return (
            <div key={s.id}>
              <h2 className="mb-2 text-sm font-semibold text-fg-muted">{t(`skills.${s.skill}`)}</h2>
              <div className="space-y-2">
                {s.groups.flatMap((g) =>
                  g.questions.map((q) => (
                    <ReviewRow
                      key={q.id}
                      q={q}
                      attemptId={attempt.id}
                      canGrade={canGrade}
                      grade={grade}
                    />
                  )),
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReviewRow({
  q,
  attemptId,
  canGrade,
  grade,
}: {
  q: MockAttemptQuestion;
  attemptId: string;
  canGrade: boolean;
  grade: ReturnType<typeof useGradeMock>;
}) {
  const t = useTranslations("mock");
  const auto = q.isCorrect != null;
  const manual = !auto && (q.isGraded || q.score != null);

  return (
    <Card className="p-4">
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums",
            q.isCorrect === true
              ? "bg-success-bg text-success"
              : q.isCorrect === false
                ? "bg-danger-bg text-danger"
                : "bg-brand-subtle text-brand-subtle-fg",
          )}
        >
          {q.isCorrect === true ? (
            <Check className="size-3.5" />
          ) : q.isCorrect === false ? (
            <X className="size-3.5" />
          ) : (
            q.number
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-line text-sm text-fg">{q.prompt}</p>

          {/* Speaking audio */}
          {q.hasAudio && (
            <audio
              controls
              src={media(`/mock/attempts/${attemptId}/answers/${q.id}/audio`)}
              className="mt-2 h-9 w-full max-w-sm"
              preload="none"
            >
              <track kind="captions" />
            </audio>
          )}

          {/* Javob */}
          {q.response && !q.hasAudio && (
            <p className="mt-1.5 text-sm">
              <span className="text-fg-subtle">{t("yourAnswer")}: </span>
              <span className={cn("font-medium", q.isCorrect === false ? "text-danger" : "text-fg")}>
                {q.response}
              </span>
            </p>
          )}

          {/* To'g'ri javob (auto, noto'g'ri bo'lsa) */}
          {q.correctAnswers && q.correctAnswers.length > 0 && q.isCorrect === false && (
            <p className="mt-0.5 text-sm">
              <span className="text-fg-subtle">{t("correctAnswer")}: </span>
              <span className="font-medium text-success">{q.correctAnswers.join(" / ")}</span>
            </p>
          )}

          {/* Manual ball + izoh (o'quvchiga) */}
          {manual && !canGrade && (
            <p className="mt-1 text-sm text-fg-muted tabular-nums">
              {t("score")}: <span className="font-semibold text-fg">{q.score ?? "—"}</span> / {q.points}
            </p>
          )}
          {q.feedback && !canGrade && (
            <p className="mt-1 rounded-[6px] bg-bg-subtle px-2.5 py-1.5 text-sm text-fg-muted">
              {q.feedback}
            </p>
          )}

          {/* Baholash formasi (xodim) */}
          {canGrade && <GradeForm q={q} grade={grade} />}
        </div>
      </div>
    </Card>
  );
}

function GradeForm({
  q,
  grade,
}: {
  q: MockAttemptQuestion;
  grade: ReturnType<typeof useGradeMock>;
}) {
  const t = useTranslations("mock");
  const tc = useTranslations("common");
  const [score, setScore] = React.useState(q.score != null ? String(q.score) : "");
  const [feedback, setFeedback] = React.useState(q.feedback ?? "");
  const saving = grade.isPending && grade.variables?.questionId === q.id;

  function save() {
    const n = Number(score);
    if (Number.isNaN(n) || n < 0 || n > q.points) {
      toast.error(`${t("score")}: 0–${q.points}`);
      return;
    }
    grade.mutate(
      { questionId: q.id, score: n, feedback: feedback.trim() || undefined },
      {
        onSuccess: () => toast.success(tc("saved")),
        onError: () => toast.error(tc("unknownError")),
      },
    );
  }

  return (
    <div className="mt-3 space-y-2 rounded-[8px] border border-border bg-bg-subtle p-3">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-fg-muted">
          {t("score")} (0–{q.points})
        </label>
        <Input
          type="number"
          min={0}
          max={q.points}
          step={0.5}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          className="h-9 w-24"
        />
        {q.isGraded && <Badge variant="success">✓</Badge>}
      </div>
      <Textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder={t("feedback")}
        className="min-h-16"
      />
      <div className="flex justify-end">
        <Button size="sm" loading={saving} onClick={save}>
          {tc("save")}
        </Button>
      </div>
    </div>
  );
}
