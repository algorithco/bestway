"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAddQuestion } from "@/hooks/use-tests";
import { ApiError } from "@/lib/api-client";
import type { QuestionType, TestSection } from "@/lib/types";

const SECTIONS: TestSection[] = ["listening", "reading", "writing", "speaking"];
const TYPES: QuestionType[] = ["multiple_choice", "short_answer", "essay", "speaking_prompt"];
const AUTO_SECTIONS = new Set(["listening", "reading"]);

export function QuestionFormDialog({
  open,
  onClose,
  testId,
}: {
  open: boolean;
  onClose: () => void;
  testId: string;
}) {
  const t = useTranslations("tests");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addQuestion")}</DialogTitle>
        </DialogHeader>
        {open && <QuestionFormFields key={testId} testId={testId} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function QuestionFormFields({ testId, onClose }: { testId: string; onClose: () => void }) {
  const t = useTranslations("tests");
  const tc = useTranslations("common");
  const add = useAddQuestion(testId);

  const [section, setSection] = React.useState<TestSection>("listening");
  const [type, setType] = React.useState<QuestionType>("multiple_choice");
  const [prompt, setPrompt] = React.useState("");
  const [options, setOptions] = React.useState("");
  const [correctAnswer, setCorrectAnswer] = React.useState("");
  const [maxScore, setMaxScore] = React.useState("1");
  const [error, setError] = React.useState<string | null>(null);

  const isAuto = AUTO_SECTIONS.has(section);

  function submit() {
    setError(null);
    if (prompt.trim().length < 3) return setError(tc("unknownError"));
    const opts = options.split("\n").map((s) => s.trim()).filter(Boolean);
    if (type === "multiple_choice" && opts.length < 2) return setError(tc("unknownError"));
    if (isAuto && !correctAnswer.trim()) return setError(t("correctAnswerHint"));

    add.mutate(
      {
        section,
        type,
        prompt: prompt.trim(),
        ...(type === "multiple_choice" ? { options: opts } : {}),
        ...(isAuto ? { correctAnswer: correctAnswer.trim() } : {}),
        maxScore: Number(maxScore) || 1,
      },
      {
        onSuccess: () => {
          toast.success(t("questionAdded"));
          onClose();
        },
        onError: (e) => setError(e instanceof ApiError ? e.message : tc("unknownError")),
      },
    );
  }

  return (
    <>
      <DialogBody className="space-y-4">
        {error && (
          <div className="rounded-[8px] border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("section")}>
            <Select value={section} onValueChange={(v) => setSection(v as TestSection)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SECTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`sections.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("questionType")}>
            <Select value={type} onValueChange={(v) => setType(v as QuestionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((ty) => (
                  <SelectItem key={ty} value={ty}>
                    {t(`types.${ty}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label={t("prompt")} htmlFor="qprompt">
          <Textarea id="qprompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </Field>

        {type === "multiple_choice" && (
          <Field label={t("options")} htmlFor="qopts">
            <Textarea id="qopts" value={options} onChange={(e) => setOptions(e.target.value)} className="min-h-24" />
          </Field>
        )}

        {isAuto && (
          <Field label={t("correctAnswer")} hint={t("correctAnswerHint")} htmlFor="qcorrect">
            <Input id="qcorrect" value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} />
          </Field>
        )}

        <Field label={t("maxScore")} htmlFor="qmax" className="w-32">
          <Input id="qmax" type="number" min={1} value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {tc("cancel")}
        </Button>
        <Button onClick={submit} loading={add.isPending}>
          {tc("add")}
        </Button>
      </DialogFooter>
    </>
  );
}
