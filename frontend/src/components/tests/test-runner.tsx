"use client";

import * as React from "react";
import { AlertTriangle, Clock, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/app/page-header";
import { useSaveAnswer, useSubmitAttempt, useFlagCheat, useTest } from "@/hooks/use-tests";
import type { AttemptDetail, AttemptQuestion } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TestRunner({ attempt }: { attempt: AttemptDetail }) {
  const t = useTranslations("tests");
  const tc = useTranslations("common");
  const testQ = useTest(attempt.testId);
  const save = useSaveAnswer(attempt.id);
  const submit = useSubmitAttempt(attempt.id);
  const flagCheat = useFlagCheat(attempt.id);

  const [answers, setAnswers] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(attempt.questions.map((q) => [q.questionId, q.answer ?? ""])),
  );
  const [cheatSeen, setCheatSeen] = React.useState(false);

  // Anti-cheat: boshqa oynaga o'tish qayd etiladi
  React.useEffect(() => {
    function onHidden() {
      if (document.hidden) {
        setCheatSeen(true);
        flagCheat.mutate("tab_switch");
      }
    }
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, [flagCheat]);

  // Taymer
  const duration = testQ.data?.durationMinutes ?? null;
  const deadline = React.useMemo(
    () => (duration ? new Date(attempt.startedAt).getTime() + duration * 60_000 : null),
    [duration, attempt.startedAt],
  );
  const [remaining, setRemaining] = React.useState<number | null>(null);
  const submitRef = React.useRef(false);

  React.useEffect(() => {
    if (!deadline) return;
    const tick = () => setRemaining(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const doSubmit = React.useCallback(() => {
    if (submitRef.current) return;
    submitRef.current = true;
    submit.mutate(undefined, {
      onSuccess: () => toast.success(t("submitted")),
      onError: () => {
        submitRef.current = false;
        toast.error(tc("unknownError"));
      },
    });
  }, [submit, t, tc]);

  React.useEffect(() => {
    if (remaining === 0 && deadline) doSubmit();
  }, [remaining, deadline, doSubmit]);

  function setAnswer(q: AttemptQuestion, value: string) {
    setAnswers((prev) => ({ ...prev, [q.questionId]: value }));
  }
  function persist(q: AttemptQuestion, value: string) {
    save.mutate(
      { questionId: q.questionId, answer: value },
      { onError: () => toast.error(tc("saveFailed")) },
    );
  }

  const answeredCount = attempt.questions.filter((q) => (answers[q.questionId] ?? "").trim()).length;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={testQ.data?.title ?? t("title")}
        actions={
          <div className="flex items-center gap-2">
            {remaining !== null && (
              <span
                className={cn(
                  "flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-sm font-semibold tabular-nums",
                  remaining < 60 ? "bg-danger-bg text-danger" : "bg-bg-subtle text-fg",
                )}
              >
                <Clock className="size-4" />
                {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
              </span>
            )}
            <Badge variant="neutral">
              {answeredCount}/{attempt.questions.length}
            </Badge>
          </div>
        }
      />

      {cheatSeen && (
        <div className="mb-4 flex items-center gap-2 rounded-[8px] border border-warning-border bg-warning-bg/50 px-3 py-2 text-sm text-warning">
          <AlertTriangle className="size-4 shrink-0" />
          {t("tabSwitchWarning")}
        </div>
      )}

      <div className="space-y-4">
        {attempt.questions.map((q) => (
          <Card key={q.questionId} className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-brand-subtle-fg">
                {q.order}
              </span>
              <Badge variant="neutral">{t(`sections.${q.section}`)}</Badge>
            </div>
            <p className="mb-3 whitespace-pre-wrap text-fg">{q.prompt}</p>

            {q.type === "multiple_choice" && Array.isArray(q.options) ? (
              <div className="space-y-2">
                {q.options.map((opt, i) => (
                  <label
                    key={i}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-[8px] border px-3 py-2.5 text-sm transition-colors",
                      answers[q.questionId] === opt
                        ? "border-brand bg-brand-subtle/40 text-fg"
                        : "border-border hover:bg-surface-hover",
                    )}
                  >
                    <input
                      type="radio"
                      name={q.questionId}
                      checked={answers[q.questionId] === opt}
                      onChange={() => {
                        setAnswer(q, opt);
                        persist(q, opt);
                      }}
                      className="accent-brand"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            ) : q.type === "short_answer" ? (
              <Input
                value={answers[q.questionId] ?? ""}
                onChange={(e) => setAnswer(q, e.target.value)}
                onBlur={(e) => persist(q, e.target.value)}
                placeholder={t("yourAnswer")}
              />
            ) : (
              <Textarea
                value={answers[q.questionId] ?? ""}
                onChange={(e) => setAnswer(q, e.target.value)}
                onBlur={(e) => persist(q, e.target.value)}
                placeholder={t("yourAnswer")}
                className="min-h-32"
              />
            )}
          </Card>
        ))}
      </div>

      <div className="sticky bottom-20 mt-6 flex justify-end lg:bottom-4">
        <Button
          size="lg"
          loading={submit.isPending}
          onClick={() => {
            if (confirm(t("submitConfirm"))) doSubmit();
          }}
        >
          <Send />
          {t("submit")}
        </Button>
      </div>
    </div>
  );
}
