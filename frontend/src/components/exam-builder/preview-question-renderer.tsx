"use client";

import { Mic } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { PreviewQuestion } from "./StudentPreview";

// Mirrors mock-runner.tsx branching (do not change values or branching here).
// Preview-only and inert: values flow through `value`/`onChange`, nothing is
// persisted or submitted. Choice controls use native radio/checkbox semantics;
// stored answer strings are preserved exactly.
const SINGLE_CHOICE: ReadonlySet<string> = new Set([
  "multiple_choice",
  "true_false_notgiven",
  "yes_no_notgiven",
  "matching",
  "matching_headings",
]);
const ESSAY: ReadonlySet<string> = new Set(["essay_task1", "essay_task2"]);

function optionsFor(q: PreviewQuestion): string[] {
  if (q.options && q.options.length) return q.options;
  if (q.type === "true_false_notgiven") return ["TRUE", "FALSE", "NOT GIVEN"];
  if (q.type === "yes_no_notgiven") return ["YES", "NO", "NOT GIVEN"];
  return [];
}

/** Local-only answered check used by preview navigation (never persisted). */
export function isPreviewAnswered(q: PreviewQuestion, value: string): boolean {
  if (q.type === "speaking_task") return false;
  return value.trim().length > 0;
}

function QuestionHeader({ number, prompt }: { number: number; prompt: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        aria-hidden="true"
        className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-subtle text-xs font-semibold text-brand-subtle-fg tabular-nums"
      >
        {number}
      </span>
      <p className="whitespace-pre-line pt-px text-sm leading-relaxed text-fg">{prompt}</p>
    </div>
  );
}

function ChoiceOptions({
  question: q,
  value,
  onChange,
  multiple,
}: {
  question: PreviewQuestion;
  value: string;
  onChange: (v: string) => void;
  multiple: boolean;
}) {
  const opts = optionsFor(q);
  const selected = multiple ? value.split(",").map((v) => v.trim()).filter(Boolean) : [];

  function toggle(opt: string) {
    const next = selected.includes(opt)
      ? selected.filter((v) => v !== opt)
      : [...selected, opt];
    onChange(next.join(","));
  }

  return (
    <fieldset>
      <legend className="sr-only">{`Question ${q.number}`}</legend>
      <div className="mt-1.5 space-y-1 pl-[34px]">
        {opts.map((opt) => {
          const checked = multiple ? selected.includes(opt) : value === opt;
          return (
            <label
              key={opt}
              className={cn(
                "flex min-h-10 cursor-pointer items-center gap-3 rounded-[6px] border px-3 py-1.5 text-sm leading-snug transition-colors",
                checked
                  ? "border-brand bg-brand-subtle font-medium text-brand-subtle-fg"
                  : "border-border bg-transparent text-fg hover:border-border-strong",
              )}
            >
              <input
                type={multiple ? "checkbox" : "radio"}
                name={`preview-answer-${q.id}`}
                value={opt}
                checked={checked}
                onChange={() => (multiple ? toggle(opt) : onChange(opt))}
                className="size-4 shrink-0 accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              />
              <span className="min-w-0 flex-1 break-words">{opt}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function PreviewQuestionInput({
  question: q,
  value,
  onChange,
}: {
  question: PreviewQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useTranslations("mock");

  if (q.type === "speaking_task") {
    return (
      <div className="space-y-2">
        <QuestionHeader number={q.number} prompt={q.prompt} />
        <div className="ml-[34px] flex flex-wrap items-center gap-3 rounded-[6px] border border-border bg-bg-subtle p-3">
          <Button size="sm" variant="outline" disabled aria-disabled="true">
            <Mic aria-hidden />
            {t("record")}
          </Button>
          <span className="text-xs text-fg-subtle">
            Recording is disabled in preview — students record here.
          </span>
        </div>
      </div>
    );
  }

  if (ESSAY.has(q.type)) {
    const words = value.trim() ? value.trim().split(/\s+/).length : 0;
    const minWords =
      q.type === "essay_task1" ? 150 : q.type === "essay_task2" ? 250 : (q.wordLimit ?? 0);
    const underMin = minWords > 0 && words > 0 && words < minWords;
    return (
      <div className="space-y-2">
        <QuestionHeader number={q.number} prompt={q.prompt} />
        <div className="pl-[34px]">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="min-h-32 sm:min-h-48"
            placeholder="..."
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
            aria-label={`Answer for question ${q.number}`}
          />
          <p
            className={cn(
              "mt-1 text-right text-xs tabular-nums",
              underMin ? "text-warning" : "text-fg-subtle",
            )}
          >
            {words} {t("words")}
            {minWords > 0 ? ` · min ${minWords}` : ""}
            {underMin ? ` — minimum ${minWords} words required` : ""}
          </p>
        </div>
      </div>
    );
  }

  if (SINGLE_CHOICE.has(q.type)) {
    return (
      <div>
        <QuestionHeader number={q.number} prompt={q.prompt} />
        <ChoiceOptions question={q} value={value} onChange={onChange} multiple={false} />
      </div>
    );
  }

  if (q.type === "multi_select") {
    return (
      <div>
        <QuestionHeader number={q.number} prompt={q.prompt} />
        <ChoiceOptions question={q} value={value} onChange={onChange} multiple />
      </div>
    );
  }

  // TEXT_INPUT and completion types (default): compact input.
  return (
    <div className="flex items-start gap-2.5">
      <span
        aria-hidden="true"
        className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-subtle text-xs font-semibold text-brand-subtle-fg tabular-nums"
      >
        {q.number}
      </span>
      <div className="min-w-0 flex-1">
        {q.prompt && (
          <p className="mb-1 whitespace-pre-line text-sm leading-relaxed text-fg">{q.prompt}</p>
        )}
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`Answer for question ${q.number}`}
          className="min-h-10"
        />
      </div>
    </div>
  );
}
