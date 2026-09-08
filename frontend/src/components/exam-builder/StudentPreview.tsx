"use client";

import * as React from "react";
import { Mic } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { MockSkill } from "@/lib/types";
import { tx } from "./types";

export interface PreviewQuestion {
  id: string;
  number: number;
  type: string;
  prompt: string;
  options: string[] | null;
  points: number;
  wordLimit: number | null;
}

export interface PreviewGroup {
  id: string;
  title: string | null;
  instructions: string | null;
  passageText: string | null;
  hasAudio: boolean;
  imageUrl: string | null;
  questions: PreviewQuestion[];
}

// Mirrors mock-runner.tsx (the real student renderer — do not change that
// file for preview). Same branching, same class names, same option defaults.
// Differences are preview-only and inert: answers live in local state (never
// persisted), audio plays without attempt-scoped replay rules, and the
// speaking recorder is disabled (no microphone, no upload).
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

/**
 * Read-only student view of one block — the shape students answer.
 * Interactive like a student (answers stay local, nothing is saved), with no
 * answer keys, no points editing, no ids, no validation output.
 */
export function StudentPreview({
  group,
  skill,
  audioSrc,
  imageSrc,
}: {
  group: PreviewGroup;
  skill: MockSkill;
  audioSrc?: string | null;
  imageSrc?: string | null;
}) {
  const t = useTranslations("examBuilder");
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">
        {tx(t, "studentView", "Student view")}
      </p>
      {/* Fresh answer sheet per block (key); never persisted, never submitted. */}
      <PreviewBody key={group.id} group={group} skill={skill} audioSrc={audioSrc} imageSrc={imageSrc} />
      <div className="mt-2">
        <Badge variant="info">{tx(t, "previewNote", "Preview only — students see this after you publish.")}</Badge>
      </div>
    </div>
  );
}

function PreviewBody({
  group,
  skill,
  audioSrc,
  imageSrc,
}: {
  group: PreviewGroup;
  skill: MockSkill;
  audioSrc?: string | null;
  imageSrc?: string | null;
}) {
  const t = useTranslations("examBuilder");
  const [answers, setAnswers] = React.useState<Record<string, string>>({});

  function setAnswer(qid: string, val: string) {
    setAnswers((a) => ({ ...a, [qid]: val }));
  }

  const hasPassage = !!(group.passageText && group.passageText.trim());
  const resolvedAudioSrc = audioSrc ?? `/api/backend/mock/groups/${group.id}/audio`;
  const resolvedImageSrc =
    imageSrc ?? (group.imageUrl ? `/api/backend/mock/groups/${group.id}/image` : null);

  return (
    <Card className="mt-1.5 p-4 sm:p-5">
        {group.title?.trim() && <h3 className="font-semibold text-fg">{group.title}</h3>}
        {skill === "listening" && !group.hasAudio && (
          <p className="mt-3 rounded-[8px] border border-warning/25 bg-warning/5 px-3 py-2 text-xs text-fg-muted">
            {tx(t, "noAudioPreview", "No audio uploaded — students see no player here.")}
          </p>
        )}
        {group.hasAudio && (
          <audio controls src={resolvedAudioSrc} className="mt-3 w-full" preload="none">
            <track kind="captions" />
          </audio>
        )}
        {resolvedImageSrc && (
          // eslint-disable-next-line @next/next/no-img-element -- authenticated /api/backend mock image route; next/image optimizer bypass is intentional
          <img
            src={resolvedImageSrc}
            alt=""
            loading="lazy"
            decoding="async"
            className="mt-3 max-h-96 w-full rounded-[8px] border border-border object-contain"
          />
        )}
        {group.instructions?.trim() && (
          <p className="mt-3 text-sm font-medium text-fg-muted">{group.instructions}</p>
        )}

        <div className={cn("mt-3", hasPassage && "lg:grid lg:grid-cols-2 lg:gap-6")}>
          {hasPassage && (
            <div className="mb-4 max-h-[70vh] overflow-y-auto whitespace-pre-line rounded-[8px] border border-border bg-bg-subtle p-4 text-sm leading-relaxed text-fg lg:mb-0">
              {group.passageText}
            </div>
          )}
          <div className="space-y-4">
            {group.questions.map((q) => (
              <PreviewQuestionInput
                key={q.id}
                question={q}
                value={answers[q.id] ?? ""}
                onChange={(v) => setAnswer(q.id, v)}
              />
            ))}
            {group.questions.length === 0 && (
              <p className="text-sm text-fg-muted">
                {tx(t, "noQuestionsPreview", "No questions yet.")}
              </p>
            )}
        </div>
      </div>
    </Card>
  );
}

function PreviewQuestionInput({
  question: q,
  value,
  onChange,
}: {
  question: PreviewQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useTranslations("mock");

  const header = (
    <div className="flex items-start gap-2">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-subtle text-xs font-semibold text-brand-subtle-fg tabular-nums">
        {q.number}
      </span>
      <p className="whitespace-pre-line text-sm text-fg">{q.prompt}</p>
    </div>
  );

  if (q.type === "speaking_task") {
    return (
      <div className="space-y-2">
        {header}
        <div className="flex flex-wrap items-center gap-3 rounded-[8px] border border-border bg-bg-subtle p-3">
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
    const minWords = q.type === "essay_task1" ? 150 : q.type === "essay_task2" ? 250 : (q.wordLimit ?? 0);
    const underMin = minWords > 0 && words > 0 && words < minWords;
    return (
      <div className="space-y-2">
        {header}
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-48"
          placeholder="..."
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          autoComplete="off"
          aria-label={`Answer for question ${q.number}`}
        />
        <p className={cn("text-right text-xs tabular-nums", underMin ? "text-warning" : "text-fg-subtle")}>
          {words} {t("words")}
          {minWords > 0 ? ` · min ${minWords}` : ""}
          {underMin ? ` — minimum ${minWords} words required` : ""}
        </p>
      </div>
    );
  }

  if (SINGLE_CHOICE.has(q.type)) {
    const opts = optionsFor(q);
    return (
      <div className="space-y-2">
        {header}
        <div className="flex flex-wrap gap-2">
          {opts.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              aria-pressed={value === opt}
              className={cn(
                "rounded-[8px] border px-3 py-1.5 text-sm transition-colors",
                value === opt
                  ? "border-brand bg-brand-subtle font-medium text-brand-subtle-fg"
                  : "border-border bg-surface text-fg-muted hover:bg-surface-hover",
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (q.type === "multi_select") {
    const opts = optionsFor(q);
    const selected = value ? value.split(",").map((v) => v.trim()) : [];
    function toggle(opt: string) {
      const next = selected.includes(opt)
        ? selected.filter((v) => v !== opt)
        : [...selected, opt];
      onChange(next.join(","));
    }
    return (
      <div className="space-y-2">
        {header}
        <div className="flex flex-wrap gap-2">
          {opts.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              aria-pressed={selected.includes(opt)}
              className={cn(
                "rounded-[8px] border px-3 py-1.5 text-sm transition-colors",
                selected.includes(opt)
                  ? "border-brand bg-brand-subtle font-medium text-brand-subtle-fg"
                  : "border-border bg-surface text-fg-muted hover:bg-surface-hover",
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // TEXT_INPUT (default)
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-subtle text-xs font-semibold text-brand-subtle-fg tabular-nums">
        {q.number}
      </span>
      <div className="min-w-0 flex-1">
        {q.prompt && <p className="mb-1 whitespace-pre-line text-sm text-fg">{q.prompt}</p>}
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`Answer for question ${q.number}`}
        />
      </div>
    </div>
  );
}
