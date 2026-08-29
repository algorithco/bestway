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
import { useAddMockQuestions, useImportMockQuestions } from "@/hooks/use-mock";
import { ApiError } from "@/lib/api-client";
import type { MockQuestionType, MockSkill } from "@/lib/types";
import { cn } from "@/lib/utils";

const AUTO_SKILLS = new Set<MockSkill>(["listening", "reading"]);

const QTYPES: MockQuestionType[] = [
  "multiple_choice",
  "multi_select",
  "true_false_notgiven",
  "yes_no_notgiven",
  "matching",
  "matching_headings",
  "sentence_completion",
  "note_completion",
  "summary_completion",
  "table_completion",
  "short_answer",
  "map_labelling",
  "essay_task1",
  "essay_task2",
  "speaking_task",
];
const QLABEL: Record<MockQuestionType, string> = {
  multiple_choice: "Multiple choice",
  multi_select: "Multiple select",
  true_false_notgiven: "True / False / Not Given",
  yes_no_notgiven: "Yes / No / Not Given",
  matching: "Matching",
  matching_headings: "Matching headings",
  sentence_completion: "Sentence completion",
  note_completion: "Note completion",
  summary_completion: "Summary completion",
  table_completion: "Table completion",
  short_answer: "Short answer",
  map_labelling: "Map / diagram labelling",
  essay_task1: "Writing Task 1",
  essay_task2: "Writing Task 2",
  speaking_task: "Speaking task",
};
const OPTION_TYPES = new Set<MockQuestionType>([
  "multiple_choice",
  "multi_select",
  "matching",
  "matching_headings",
]);

function parseAnswers(text: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*(\d+)\s*[:.)-]?\s*(.+?)\s*$/);
    if (m) map[m[1]] = m[2];
  }
  return map;
}

export function MockQuestionsDialog({
  examId,
  groupId,
  skill,
  open,
  onClose,
}: {
  examId: string;
  groupId: string;
  skill: MockSkill;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("mock");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("addQuestions")}</DialogTitle>
        </DialogHeader>
        {open && (
          <MockQuestionsFields
            key={`${groupId}-${skill}`}
            examId={examId}
            groupId={groupId}
            skill={skill}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MockQuestionsFields({
  examId,
  groupId,
  skill,
  onClose,
}: {
  examId: string;
  groupId: string;
  skill: MockSkill;
  onClose: () => void;
}) {
  const t = useTranslations("mock");
  const tc = useTranslations("common");
  const isAuto = AUTO_SKILLS.has(skill);
  const importMut = useImportMockQuestions(examId);
  const addMut = useAddMockQuestions(examId);

  const [mode, setMode] = React.useState<"import" | "manual">("import");
  const [error, setError] = React.useState<string | null>(null);

  // Import
  const [text, setText] = React.useState("");
  const [answerKey, setAnswerKey] = React.useState("");
  const [points, setPoints] = React.useState("1");

  // Manual
  const [mNumber, setMNumber] = React.useState("");
  const [mType, setMType] = React.useState<MockQuestionType>(
    isAuto ? "multiple_choice" : "essay_task2",
  );
  const [mPrompt, setMPrompt] = React.useState("");
  const [mOptions, setMOptions] = React.useState("");
  const [mCorrect, setMCorrect] = React.useState("");
  const [mPoints, setMPoints] = React.useState(isAuto ? "1" : "9");
  const [mWordLimit, setMWordLimit] = React.useState("");

  function submitImport() {
    setError(null);
    if (text.trim().length < 3) return setError(tc("unknownError"));
    importMut.mutate(
      {
        groupId,
        text: text.trim(),
        answers: isAuto ? parseAnswers(answerKey) : undefined,
        points: Number(points) || 1,
      },
      {
        onSuccess: (res) => {
          toast.success(t("imported", { count: res.added }));
          onClose();
        },
        onError: (e) => setError(e instanceof ApiError ? e.message : tc("unknownError")),
      },
    );
  }

  function submitManual() {
    setError(null);
    const num = Number(mNumber);
    if (!num || num < 1) return setError(t("questionNumber"));
    if (mPrompt.trim().length < 1) return setError(t("prompt"));
    const options = OPTION_TYPES.has(mType)
      ? mOptions.split("\n").map((s) => s.trim()).filter(Boolean)
      : undefined;
    const correctAnswers = isAuto
      ? mCorrect.split(/[|,]/).map((s) => s.trim()).filter(Boolean)
      : undefined;
    addMut.mutate(
      {
        groupId,
        questions: [
          {
            number: num,
            type: mType,
            prompt: mPrompt.trim(),
            options,
            correctAnswers,
            points: Number(mPoints) || 1,
            wordLimit: mWordLimit ? Number(mWordLimit) : undefined,
          },
        ],
      },
      {
        onSuccess: () => {
          toast.success(tc("saved"));
          onClose();
        },
        onError: (e) => setError(e instanceof ApiError ? e.message : tc("unknownError")),
      },
    );
  }

  const isEssay = mType === "essay_task1" || mType === "essay_task2";

  return (
    <>
      <DialogBody className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(["import", "manual"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                "rounded-[8px] border px-3 py-2 text-sm font-medium transition-colors",
                mode === m
                  ? "border-brand bg-brand-subtle text-brand-subtle-fg"
                  : "border-border bg-surface text-fg-muted hover:bg-surface-hover",
              )}
            >
              {m === "import" ? t("importQuestions") : t("manualAdd")}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-[8px] border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        {mode === "import" ? (
          <>
            <Field label={t("questionsText")} htmlFor="qtext">
              <Textarea
                id="qtext"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-40 font-mono text-xs"
                placeholder={"1. The capital of ...\n2. ...\n"}
              />
            </Field>
            {isAuto && (
              <Field label={t("answerKey")} hint={t("answerKeyHint")} htmlFor="qkey">
                <Textarea
                  id="qkey"
                  value={answerKey}
                  onChange={(e) => setAnswerKey(e.target.value)}
                  className="min-h-24 font-mono text-xs"
                  placeholder={"1: B\n2: flowers/flower\n3: TRUE"}
                />
              </Field>
            )}
            <Field label={t("points")} htmlFor="qpts">
              <Input
                id="qpts"
                type="number"
                min={1}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                className="w-28"
              />
            </Field>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("questionNumber")} htmlFor="mnum">
                <Input
                  id="mnum"
                  type="number"
                  min={1}
                  value={mNumber}
                  onChange={(e) => setMNumber(e.target.value)}
                />
              </Field>
              <Field label={t("questionType")}>
                <Select value={mType} onValueChange={(v) => setMType(v as MockQuestionType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QTYPES.map((qt) => (
                      <SelectItem key={qt} value={qt}>
                        {QLABEL[qt]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label={t("prompt")} htmlFor="mprompt">
              <Textarea
                id="mprompt"
                value={mPrompt}
                onChange={(e) => setMPrompt(e.target.value)}
                className="min-h-20"
              />
            </Field>
            {OPTION_TYPES.has(mType) && (
              <Field label={t("options")} hint={t("optionsHint")} htmlFor="mopts">
                <Textarea
                  id="mopts"
                  value={mOptions}
                  onChange={(e) => setMOptions(e.target.value)}
                  className="min-h-20"
                />
              </Field>
            )}
            {isAuto && (
              <Field label={t("correctAnswer")} hint={t("correctAnswerHint")} htmlFor="mcorr">
                <Input
                  id="mcorr"
                  value={mCorrect}
                  onChange={(e) => setMCorrect(e.target.value)}
                  placeholder="B  ·  flowers|flower"
                />
              </Field>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("points")} htmlFor="mpts">
                <Input
                  id="mpts"
                  type="number"
                  min={1}
                  value={mPoints}
                  onChange={(e) => setMPoints(e.target.value)}
                />
              </Field>
              {isEssay && (
                <Field label={t("wordLimit")} htmlFor="mwl">
                  <Input
                    id="mwl"
                    type="number"
                    min={1}
                    value={mWordLimit}
                    onChange={(e) => setMWordLimit(e.target.value)}
                  />
                </Field>
              )}
            </div>
          </>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {tc("cancel")}
        </Button>
        {mode === "import" ? (
          <Button onClick={submitImport} loading={importMut.isPending}>
            {t("importQuestions")}
          </Button>
        ) : (
          <Button onClick={submitManual} loading={addMut.isPending}>
            {tc("add")}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
