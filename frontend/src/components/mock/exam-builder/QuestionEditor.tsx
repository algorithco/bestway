"use client";

import type { JSX } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MockQuestionType, MockSkill } from "@/lib/types";
import { GROUPED_TYPES, QTYPE_LABEL, isAutoType, type BuilderQuestion } from "./types";

const OPTION_TYPES: ReadonlySet<MockQuestionType> = new Set([
  "multiple_choice",
  "multi_select",
  "matching",
  "matching_headings",
]);

const WORD_LIMIT_TYPES: ReadonlySet<MockQuestionType> = new Set([
  "short_answer",
  "sentence_completion",
  "note_completion",
  "summary_completion",
  "table_completion",
]);

const AUTO_SKILLS: ReadonlySet<MockSkill> = new Set(["listening", "reading"]);

export function QuestionEditor(props: {
  question: BuilderQuestion;
  skill: MockSkill;
  allowedTypes: MockQuestionType[];
  onChange: (q: BuilderQuestion) => void;
  onRemove: () => void;
}): JSX.Element {
  const { question, skill, allowedTypes, onChange, onRemove } = props;
  const t = useTranslations("wizard");
  const tc = useTranslations("common");

  const showOptions = OPTION_TYPES.has(question.type);
  const showAnswers = isAutoType(question.type) && AUTO_SKILLS.has(skill);
  const showWordLimit = WORD_LIMIT_TYPES.has(question.type);
  const allowed = new Set<MockQuestionType>(allowedTypes);

  function handleTypeChange(value: string): void {
    const next = value as MockQuestionType;
    if (next === question.type) return;
    const wasAuto = isAutoType(question.type);
    const willAuto = isAutoType(next);
    onChange({
      ...question,
      type: next,
      points: wasAuto === willAuto ? question.points : willAuto ? 1 : 9,
    });
  }

  const ids = {
    number: `qe-${question.clientId}-number`,
    type: `qe-${question.clientId}-type`,
    prompt: `qe-${question.clientId}-prompt`,
    options: `qe-${question.clientId}-options`,
    correct: `qe-${question.clientId}-correct`,
    variants: `qe-${question.clientId}-variants`,
    points: `qe-${question.clientId}-points`,
    wordLimit: `qe-${question.clientId}-wordlimit`,
  };

  return (
    <div className="space-y-3 rounded-[8px] border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-fg">#{question.number}</span>
          {question.savedQuestionId ? (
            <span className="shrink-0 rounded-[6px] border border-border bg-surface-hover px-1.5 py-0.5 text-[11px] text-fg-muted">
              saved
            </span>
          ) : null}
        </div>
        <Button type="button" variant="danger" size="sm" onClick={onRemove}>
          {tc("delete")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("questionNumber")} htmlFor={ids.number}>
          <Input
            id={ids.number}
            type="number"
            min={1}
            value={question.number}
            onChange={(e) => {
              const v = Number(e.target.value);
              onChange({ ...question, number: Number.isFinite(v) ? v : question.number });
            }}
          />
        </Field>
        <Field label={t("questionType")} htmlFor={ids.type}>
          <Select value={question.type} onValueChange={handleTypeChange}>
            <SelectTrigger id={ids.type}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROUPED_TYPES.map((g) => {
                const types = g.types.filter((qt) => allowed.has(qt));
                if (types.length === 0) return null;
                return (
                  <SelectGroup key={g.group}>
                    <SelectLabel>{g.group}</SelectLabel>
                    {types.map((qt) => (
                      <SelectItem key={qt} value={qt}>
                        {QTYPE_LABEL[qt]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                );
              })}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label={t("prompt")} htmlFor={ids.prompt}>
        <Textarea
          id={ids.prompt}
          value={question.prompt}
          onChange={(e) => onChange({ ...question, prompt: e.target.value })}
          className="min-h-20"
        />
      </Field>

      {showOptions && (
        <Field label={t("options")} hint={t("optionsHint")} htmlFor={ids.options}>
          <Textarea
            id={ids.options}
            value={question.options.join("\n")}
            onChange={(e) => onChange({ ...question, options: e.target.value.split("\n") })}
            className="min-h-20"
          />
        </Field>
      )}

      {showAnswers && (
        <Field label={t("correctAnswer")} hint={t("answerHint")} htmlFor={ids.correct}>
          <Input
            id={ids.correct}
            value={question.correctAnswers.join("|")}
            onChange={(e) =>
              onChange({ ...question, correctAnswers: e.target.value.split(/[|,]/) })
            }
          />
        </Field>
      )}

      {showAnswers && (
        <Field label={t("variants")} hint={t("variantsHint")} htmlFor={ids.variants}>
          <Input
            id={ids.variants}
            value={question.acceptedVariants.join("|")}
            onChange={(e) =>
              onChange({ ...question, acceptedVariants: e.target.value.split(/[|,]/) })
            }
          />
        </Field>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("points")} htmlFor={ids.points}>
          <Input
            id={ids.points}
            type="number"
            min={1}
            value={question.points}
            onChange={(e) => {
              const v = Number(e.target.value);
              onChange({ ...question, points: Number.isFinite(v) ? v : question.points });
            }}
          />
        </Field>
        {showWordLimit && (
          <Field label="Word limit" htmlFor={ids.wordLimit}>
            <Input
              id={ids.wordLimit}
              type="number"
              min={1}
              value={question.wordLimit ?? ""}
              onChange={(e) =>
                onChange({
                  ...question,
                  wordLimit: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </Field>
        )}
      </div>
    </div>
  );
}
