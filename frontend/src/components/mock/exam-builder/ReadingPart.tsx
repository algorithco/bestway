"use client";

import type { JSX } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import type { MockQuestionType } from "@/lib/types";
import { QuestionEditor } from "./QuestionEditor";
import {
  QTYPE_LABEL,
  newQuestion,
  type BuilderPart,
  type BuilderQuestion,
} from "./types";

const EXCLUDED_TYPES: ReadonlySet<MockQuestionType> = new Set([
  "essay_task1",
  "essay_task2",
  "speaking_task",
]);

export function ReadingPart(props: {
  part: BuilderPart;
  partLabel: string;
  onChange: (p: BuilderPart) => void;
}): JSX.Element {
  const { part, partLabel, onChange } = props;
  const t = useTranslations("wizard");

  const allowedTypes = (Object.keys(QTYPE_LABEL) as MockQuestionType[]).filter(
    (qt) => !EXCLUDED_TYPES.has(qt),
  );

  function updateQuestion(clientId: string, next: BuilderQuestion): void {
    onChange({
      ...part,
      questions: part.questions.map((q) => (q.clientId === clientId ? next : q)),
    });
  }

  function removeQuestion(clientId: string): void {
    onChange({ ...part, questions: part.questions.filter((q) => q.clientId !== clientId) });
  }

  function addQuestion(): void {
    const max = part.questions.reduce((m, q) => Math.max(m, q.number), 0);
    onChange({ ...part, questions: [...part.questions, newQuestion(max + 1, "multiple_choice", true)] });
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-fg">{partLabel}</h3>

      <Field label={t("blockTitle")} htmlFor={`rp-${part.clientId}-title`}>
        <Textarea
          id={`rp-${part.clientId}-title`}
          value={part.title}
          onChange={(e) => onChange({ ...part, title: e.target.value })}
        />
      </Field>

      <Field label={t("instructions")} htmlFor={`rp-${part.clientId}-instructions`}>
        <Textarea
          id={`rp-${part.clientId}-instructions`}
          value={part.instructions}
          onChange={(e) => onChange({ ...part, instructions: e.target.value })}
        />
      </Field>

      <Field label={t("passage")} hint={t("passageHint")} htmlFor={`rp-${part.clientId}-passage`}>
        <Textarea
          id={`rp-${part.clientId}-passage`}
          value={part.passageText}
          onChange={(e) => onChange({ ...part, passageText: e.target.value })}
          className="min-h-32"
        />
      </Field>

      <div className="space-y-3">
        {part.questions.map((q) => (
          <QuestionEditor
            key={q.clientId}
            question={q}
            skill="reading"
            allowedTypes={allowedTypes}
            onChange={(next) => updateQuestion(q.clientId, next)}
            onRemove={() => removeQuestion(q.clientId)}
          />
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
        {t("addQuestion")}
      </Button>
    </div>
  );
}
