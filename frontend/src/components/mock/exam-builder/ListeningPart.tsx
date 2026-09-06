"use client";

import * as React from "react";
import type { JSX } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import type { MockQuestionType } from "@/lib/types";
import { QuestionEditor } from "./QuestionEditor";
import { newQuestion, type BuilderPart, type BuilderQuestion } from "./types";

/** Allowed question types for listening — no essays / speaking tasks. */
const LISTENING_TYPES: MockQuestionType[] = [
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
];

function fmtDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function ListeningPart(props: {
  part: BuilderPart;
  partLabel: string;
  onChange: (p: BuilderPart) => void;
}): JSX.Element {
  const { part, partLabel, onChange } = props;
  const t = useTranslations("wizard");
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const urlRef = React.useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  const hasPreview = part.hasAudio || part.audioPendingFile != null;

  function revokePreview(): void {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }

  // Unmount tozalash (revoke faqat unmount da — effect bodysiz).
  React.useEffect(() => revokePreview, []);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    revokePreview();
    urlRef.current = URL.createObjectURL(file);
    setPreviewUrl(urlRef.current);
    onChange({ ...part, audioPendingFile: file, audioFileName: file.name, hasAudio: true });
  }

  function onRemoveAudio(): void {
    revokePreview();
    setPreviewUrl(null);
    onChange({
      ...part,
      audioPendingFile: null,
      audioFileName: undefined,
      audioDurationSec: undefined,
      hasAudio: false,
    });
  }

  function onPlayLimitChange(raw: string): void {
    const n = Number(raw);
    const clamped = !Number.isFinite(n) ? 1 : Math.min(10, Math.max(1, Math.floor(n)));
    onChange({ ...part, audioPlayLimit: clamped });
  }

  function onLoadedMetadata(e: React.SyntheticEvent<HTMLAudioElement>): void {
    const d = e.currentTarget.duration;
    if (Number.isFinite(d) && d > 0) {
      const sec = Math.round(d);
      if (sec !== part.audioDurationSec) onChange({ ...part, audioDurationSec: sec });
    }
  }

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

      {/* 1) Audio block */}
      <div className="space-y-3 rounded-[8px] border border-border bg-surface p-3">
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          aria-label={t("uploadAudio")}
          onChange={onPickFile}
        />
        {!hasPreview ? (
          <div className="space-y-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload />
              {t("uploadAudio")}
            </Button>
            <p className="text-xs text-fg-muted">{t("audioHint")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <audio
              controls
              src={
                previewUrl ??
                (part.savedGroupId && part.hasAudio
                  ? `/api/backend/mock/groups/${part.savedGroupId}/audio`
                  : "")
              }
              className="w-full"
              preload="metadata"
              onLoadedMetadata={onLoadedMetadata}
            >
              <track kind="captions" />
            </audio>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
              {part.audioFileName ? (
                <span className="max-w-full truncate font-medium text-fg">{part.audioFileName}</span>
              ) : null}
              {part.audioDurationSec != null ? (
                <span className="tabular-nums">{fmtDuration(part.audioDurationSec)}</span>
              ) : null}
            </div>
            <p className="text-xs text-fg-muted">{t("audioHint")}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <Upload />
                {t("changeAudio")}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onRemoveAudio}>
                <Trash2 className="text-danger" />
                {t("removeAudio")}
              </Button>
            </div>
          </div>
        )}
        <Field
          label={t("playLimit")}
          htmlFor={`lp-${part.clientId}-playlimit`}
          className="max-w-32"
        >
          <Input
            id={`lp-${part.clientId}-playlimit`}
            type="number"
            min={1}
            max={10}
            value={part.audioPlayLimit}
            onChange={(e) => onPlayLimitChange(e.target.value)}
          />
        </Field>
      </div>

      {/* 2) Title + instructions */}
      <Field label={t("blockTitle")} htmlFor={`lp-${part.clientId}-title`}>
        <Input
          id={`lp-${part.clientId}-title`}
          value={part.title}
          onChange={(e) => onChange({ ...part, title: e.target.value })}
        />
      </Field>

      <Field label={t("instructions")} htmlFor={`lp-${part.clientId}-instructions`}>
        <Textarea
          id={`lp-${part.clientId}-instructions`}
          value={part.instructions}
          onChange={(e) => onChange({ ...part, instructions: e.target.value })}
          className="min-h-20"
        />
      </Field>

      {/* 3) Questions */}
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-fg">
          {t("partOfQuestions", { count: part.questions.length })}
        </p>
        <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={addQuestion}>
          <Plus />
          {t("addQuestion")}
        </Button>
      </div>

      <div className="space-y-3">
        {part.questions.map((q) => (
          <QuestionEditor
            key={q.clientId}
            question={q}
            skill="listening"
            allowedTypes={LISTENING_TYPES}
            onChange={(next) => updateQuestion(q.clientId, next)}
            onRemove={() => removeQuestion(q.clientId)}
          />
        ))}
      </div>
    </div>
  );
}
