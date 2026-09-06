"use client";

import type { JSX } from "react";
import { useTranslations } from "next-intl";
import type { MockQuestionType } from "@/lib/types";
import { QuestionEditor } from "./QuestionEditor";
import { QTYPE_LABEL, type BuilderPart, type BuilderQuestion } from "./types";

function updateQuestion(part: BuilderPart, clientId: string, next: BuilderQuestion): BuilderPart {
  return {
    ...part,
    questions: part.questions.map((q) => (q.clientId === clientId ? next : q)),
  };
}

function removeQuestion(part: BuilderPart, clientId: string): BuilderPart {
  return { ...part, questions: part.questions.filter((q) => q.clientId !== clientId) };
}

export function WritingPart(props: {
  part: BuilderPart;
  partLabel: string;
  taskKind: "task1" | "task2";
  onChange: (p: BuilderPart) => void;
}): JSX.Element {
  const { part, partLabel, taskKind, onChange } = props;
  const t = useTranslations("wizard");

  const expected: MockQuestionType = taskKind === "task1" ? "essay_task1" : "essay_task2";
  const minWords = taskKind === "task1" ? 150 : 250;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-fg">{partLabel}</h3>
      <p className="text-xs text-fg-muted">{t("minWordsNote", { n: minWords })}</p>

      <div className="space-y-3">
        {part.questions.map((q) =>
          q.type === expected ? (
            <QuestionEditor
              key={q.clientId}
              question={q}
              skill="writing"
              allowedTypes={[expected]}
              onChange={(next) => onChange(updateQuestion(part, q.clientId, next))}
              onRemove={() => onChange(removeQuestion(part, q.clientId))}
            />
          ) : (
            <p key={q.clientId} className="text-xs text-fg-muted">
              #{q.number} · {QTYPE_LABEL[q.type]} · {q.points}
            </p>
          ),
        )}
      </div>
    </div>
  );
}

export function SpeakingPart(props: {
  part: BuilderPart;
  partLabel: string;
  onChange: (p: BuilderPart) => void;
}): JSX.Element {
  const { part, partLabel, onChange } = props;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-fg">{partLabel}</h3>

      <div className="space-y-3">
        {part.questions.map((q) =>
          q.type === "speaking_task" ? (
            <QuestionEditor
              key={q.clientId}
              question={q}
              skill="speaking"
              allowedTypes={["speaking_task"]}
              onChange={(next) => onChange(updateQuestion(part, q.clientId, next))}
              onRemove={() => onChange(removeQuestion(part, q.clientId))}
            />
          ) : (
            <p key={q.clientId} className="text-xs text-fg-muted">
              #{q.number} · {QTYPE_LABEL[q.type]} · {q.points}
            </p>
          ),
        )}
      </div>
    </div>
  );
}
