"use client";

import * as React from "react";
import { ArrowLeft, Award, Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/app/page-header";
import { useGradeAnswer } from "@/hooks/use-tests";
import { useMe } from "@/hooks/use-me";
import type { AttemptDetail, AttemptQuestion } from "@/lib/types";
import { cn } from "@/lib/utils";

const MANUAL = new Set(["writing", "speaking"]);

export function AttemptReview({ attempt }: { attempt: AttemptDetail }) {
  const t = useTranslations("tests");
  const { data: me } = useMe();
  const isStaff =
    me?.user.role === "teacher" || me?.user.role === "admin" || me?.user.role === "super_admin";
  const isStudent = me?.user.role === "student";

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={isStaff ? "/tests" : "/tests"}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="size-4" />
        {t("title")}
      </Link>

      <PageHeader
        title={attempt.testTitle ?? t("result")}
        description={isStaff ? attempt.studentName : undefined}
        actions={
          attempt.status === "completed" && isStudent ? (
            <a
              href={`/api/backend/tests/attempts/${attempt.id}/certificate`}
              className="inline-flex h-8 items-center gap-2 rounded-[8px] border border-border bg-surface px-3 text-sm font-medium text-fg hover:bg-surface-hover"
            >
              <Award className="size-4" />
              {t("result")}
            </a>
          ) : undefined
        }
      />

      {/* Ballar */}
      <Card className="mb-4 p-5">
        <div className="flex items-center justify-between">
          <Badge
            variant={
              attempt.status === "completed"
                ? "success"
                : attempt.status === "grading"
                  ? "warning"
                  : "info"
            }
          >
            {t(`statusLabel.${attempt.status}`)}
          </Badge>
          {attempt.totalScore !== null && (
            <span className="text-3xl font-bold text-fg tabular-nums">{attempt.totalScore}</span>
          )}
        </div>
        <div className="mt-3 flex gap-4 text-sm text-fg-muted">
          {attempt.autoScore !== null && (
            <span>
              {t("autoScore")}: <b className="text-fg">{attempt.autoScore}</b>
            </span>
          )}
          {attempt.manualScore !== null && (
            <span>
              {t("manualScore")}: <b className="text-fg">{attempt.manualScore}</b>
            </span>
          )}
          {isStaff && attempt.antiCheatCount > 0 && (
            <span className="text-warning">
              {t("cheatFlags")}: {attempt.antiCheatCount}
            </span>
          )}
        </div>
      </Card>

      <div className="space-y-3">
        {attempt.questions.map((q) => (
          <QuestionReview key={q.questionId} q={q} attemptId={attempt.id} isStaff={!!isStaff} />
        ))}
      </div>
    </div>
  );
}

function QuestionReview({
  q,
  attemptId,
  isStaff,
}: {
  q: AttemptQuestion;
  attemptId: string;
  isStaff: boolean;
}) {
  const t = useTranslations("tests");
  const tc = useTranslations("common");
  const grade = useGradeAnswer(attemptId);
  const isManual = MANUAL.has(q.section);
  const [score, setScore] = React.useState(String(q.score ?? ""));
  const [comment, setComment] = React.useState(q.comment ?? "");

  // Avtomatik savol uchun to'g'ri/noto'g'ri
  const autoCorrect = !isManual && q.score !== null ? q.score > 0 : null;

  function submitGrade() {
    const s = Number(score);
    if (Number.isNaN(s) || s < 0 || s > q.maxScore) return;
    grade.mutate(
      { questionId: q.questionId, score: s, comment: comment.trim() || undefined },
      {
        onSuccess: () => toast.success(t("graded")),
        onError: () => toast.error(tc("unknownError")),
      },
    );
  }

  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-fg-subtle">#{q.order}</span>
          <Badge variant="neutral">{t(`sections.${q.section}`)}</Badge>
        </div>
        {autoCorrect !== null ? (
          <span className={cn("flex items-center gap-1 text-sm font-medium", autoCorrect ? "text-success" : "text-danger")}>
            {autoCorrect ? <Check className="size-4" /> : <X className="size-4" />}
            {q.score}/{q.maxScore}
          </span>
        ) : q.isGraded ? (
          <span className="text-sm font-medium text-fg tabular-nums">
            {q.score}/{q.maxScore}
          </span>
        ) : (
          <Badge variant="warning">{t("awaitingGrade")}</Badge>
        )}
      </div>

      <p className="mb-2 whitespace-pre-wrap text-sm text-fg">{q.prompt}</p>

      <div className="rounded-[8px] bg-bg-subtle px-3 py-2 text-sm">
        <span className="text-xs text-fg-subtle">{t("yourAnswer")}: </span>
        <span className="text-fg">{q.answer || <em className="text-fg-subtle">{t("noAnswer")}</em>}</span>
      </div>

      {isStaff && q.correctAnswer && (
        <p className="mt-1.5 text-xs text-success">
          {t("correctAnswer")}: {q.correctAnswer}
        </p>
      )}

      {q.comment && !isStaff && (
        <p className="mt-1.5 text-xs text-fg-muted">
          {t("comment")}: {q.comment}
        </p>
      )}

      {/* O'qituvchi qo'lda baholaydi */}
      {isStaff && isManual && (
        <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-end">
          <div className="w-24">
            <label className="text-xs text-fg-muted">
              {t("score")} (0–{q.maxScore})
            </label>
            <Input
              type="number"
              min={0}
              max={q.maxScore}
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />
          </div>
          <Input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("comment")}
            className="flex-1"
          />
          <Button size="sm" loading={grade.isPending} onClick={submitGrade}>
            {t("grade")}
          </Button>
        </div>
      )}
    </Card>
  );
}
