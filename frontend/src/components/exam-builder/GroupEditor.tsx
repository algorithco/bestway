"use client";

import * as React from "react";
import { Eye, EyeOff, ImagePlus, Music, Plus, Save, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { QuestionEditor } from "@/components/mock/exam-builder/QuestionEditor";
import {
  newQuestion,
  validatePart,
  type BuilderPart,
  type BuilderQuestion,
} from "@/components/mock/exam-builder/types";
import {
  useAddMockQuestions,
  useDeleteMockGroup,
  useDeleteMockQuestion,
  useSetMockGroupMedia,
  useUpdateMockGroup,
  useUpdateMockQuestion,
} from "@/hooks/use-mock";
import { ApiError } from "@/lib/api-client";
import type { MockExamDetail, MockQuestionType, MockSkill } from "@/lib/types";
import { ImportPanel } from "./ImportPanel";
import { ConfirmDialog } from "./ConfirmDialog";
import { StudentPreview } from "./StudentPreview";
import { SKILL_META, TYPES_BY_SKILL, nextQuestionNumber, tx, type Selection } from "./types";

function toBuilder(group: MockExamDetail["sections"][number]["groups"][number]): BuilderPart {
  return {
    clientId: group.id,
    title: group.title ?? "",
    instructions: group.instructions ?? "",
    passageText: group.passageText ?? "",
    partNumber: group.partNumber ?? undefined,
    audioFileName: undefined,
    audioPendingFile: null,
    audioDurationSec: group.audioDurationSec ?? undefined,
    audioPlayLimit: group.audioPlayLimit ?? 1,
    hasAudio: group.hasAudio,
    savedGroupId: group.id,
    questions: group.questions.map((q) => ({
      clientId: q.id,
      number: q.number,
      type: q.type,
      prompt: q.prompt,
      options: q.options ?? [],
      correctAnswers: q.correctAnswers ?? [],
      acceptedVariants: q.acceptedVariants ?? [],
      points: q.points,
      wordLimit: q.wordLimit ?? undefined,
      savedQuestionId: q.id,
    })),
  };
}

function defaultTypeFor(skill: MockSkill, existing: BuilderQuestion[]): MockQuestionType {
  if (skill === "writing")
    return existing.some((q) => q.type === "essay_task1") ? "essay_task2" : "essay_task1";
  if (skill === "speaking") return "speaking_task";
  return "multiple_choice";
}

function fmtDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * One content block editor: material (title/instructions/passage/audio) +
 * its questions with a dynamic per-type editor + import + live preview.
 * Audio belongs to the block — never per question.
 */
export function GroupEditor({
  examId,
  detail,
  sectionId,
  groupId,
  onSelect,
  registerSave,
  onDirty,
}: {
  examId: string;
  detail: MockExamDetail;
  sectionId: string;
  groupId: string;
  onSelect: (s: Selection) => void;
  registerSave: (fn: (() => Promise<boolean>) | null) => void;
  onDirty: (d: boolean) => void;
}) {
  const t = useTranslations("examBuilder");
  const tc = useTranslations("common");
  const section = detail.sections.find((s) => s.id === sectionId);
  const group = section?.groups.find((g) => g.id === groupId);
  const skill: MockSkill = section?.skill ?? "listening";
  const meta = SKILL_META[skill];

  const updateGroup = useUpdateMockGroup(examId);
  const addQuestions = useAddMockQuestions(examId);
  const updateQuestion = useUpdateMockQuestion(examId);
  const deleteQuestion = useDeleteMockQuestion(examId);
  const setMedia = useSetMockGroupMedia(examId);
  const delGroup = useDeleteMockGroup(examId);

  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [showImport, setShowImport] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  const audioRef = React.useRef<HTMLInputElement | null>(null);
  const imageRef = React.useRef<HTMLInputElement | null>(null);
  const [localAudioUrl, setLocalAudioUrl] = React.useState<string | null>(null);
  const [localImageUrl, setLocalImageUrl] = React.useState<string | null>(null);

  // Fresh server snapshot per group (parent keys by groupId).
  const [snapshot, setSnapshot] = React.useState<BuilderPart | null>(() => (group ? toBuilder(group) : null));
  const [part, setPart] = React.useState<BuilderPart | null>(() => snapshot);
  React.useEffect(
    () => () => {
      if (localAudioUrl) URL.revokeObjectURL(localAudioUrl);
      if (localImageUrl) URL.revokeObjectURL(localImageUrl);
    },
    [localAudioUrl, localImageUrl],
  );

  const dirty = React.useMemo(
    () => JSON.stringify(part) !== JSON.stringify(snapshot) || imageFile != null,
    [part, snapshot, imageFile],
  );
  React.useEffect(() => onDirty(dirty), [dirty, onDirty]);

  const save = React.useCallback(async () => {
    const p = part;
    const g = group;
    if (!p || !g) return false;
    const errs = validatePart(skill, p);
    setErrors(errs);
    if (errs.length > 0) {
      toast.error(tx(t, "fixErrors", "Fix the errors above first."));
      return false;
    }
    setSaving(true);
    try {
      await updateGroup.mutateAsync({
        groupId: g.id,
        input: {
          title: p.title.trim() || undefined,
          instructions: p.instructions.trim() || undefined,
          passageText: p.passageText.trim() || undefined,
          partNumber: p.partNumber,
          audioDurationSec: p.audioDurationSec,
          audioPlayLimit: p.audioPlayLimit,
        },
      });
      const liveIds = new Set(p.questions.map((q) => q.savedQuestionId).filter(Boolean));
      const removed = (g.questions ?? []).map((q) => q.id).filter((id) => !liveIds.has(id));
      for (const qid of removed) await deleteQuestion.mutateAsync(qid);
      for (const q of p.questions) {
        if (!q.savedQuestionId) continue;
        await updateQuestion.mutateAsync({
          questionId: q.savedQuestionId,
          input: {
            number: q.number,
            type: q.type,
            prompt: q.prompt,
            options: q.options.length ? q.options : undefined,
            correctAnswers: q.correctAnswers.length ? q.correctAnswers : undefined,
            acceptedVariants: q.acceptedVariants.length ? q.acceptedVariants : undefined,
            points: q.points,
            wordLimit: q.wordLimit,
          },
        });
      }
      const fresh = p.questions.filter((q) => !q.savedQuestionId);
      if (fresh.length > 0) {
        await addQuestions.mutateAsync({
          groupId: g.id,
          questions: fresh.map((q) => ({
            number: q.number,
            type: q.type,
            prompt: q.prompt,
            options: q.options.length ? q.options : undefined,
            correctAnswers: q.correctAnswers.length ? q.correctAnswers : undefined,
            acceptedVariants: q.acceptedVariants.length ? q.acceptedVariants : undefined,
            points: q.points,
            wordLimit: q.wordLimit,
          })),
        });
      }
      if (p.audioPendingFile || imageFile) {
        const form = new FormData();
        if (p.audioPendingFile) form.append("audio", p.audioPendingFile);
        if (imageFile) form.append("image", imageFile);
        await setMedia.mutateAsync({ groupId: g.id, form });
      }
      toast.success(tc("saved"));
      setErrors([]);
      const cleaned: BuilderPart = { ...p, audioPendingFile: null, audioFileName: p.audioPendingFile ? p.audioPendingFile.name : p.audioFileName };
      setSnapshot(JSON.parse(JSON.stringify(cleaned)));
      setPart(cleaned);
      if (imageFile) setImageFile(null);
      if (localAudioUrl) {
        URL.revokeObjectURL(localAudioUrl);
        setLocalAudioUrl(null);
      }
      if (localImageUrl) {
        URL.revokeObjectURL(localImageUrl);
        setLocalImageUrl(null);
      }
      return true;
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : tc("unknownError");
      setErrors([msg]);
      toast.error(msg);
      return false;
    } finally {
      setSaving(false);
    }
  }, [part, group, skill, imageFile, updateGroup, deleteQuestion, updateQuestion, addQuestions, setMedia, t, tc]);

  React.useEffect(() => {
    registerSave(() => save());
    return () => registerSave(null);
  }, [registerSave, save]);

  if (!section || !group || !part) return null;

  function update(fn: (p: BuilderPart) => BuilderPart) {
    setPart((p) => (p ? fn(p) : p));
  }

  function addQuestion() {
    const p = part;
    if (!p) return;
    const maxLocal = p.questions.reduce((m, q) => Math.max(m, q.number), 0);
    const maxExam = nextQuestionNumber(detail.sections) - 1;
    const number = Math.max(maxLocal, maxExam) + 1;
    const type = defaultTypeFor(skill, p.questions);
    const auto = type !== "essay_task1" && type !== "essay_task2" && type !== "speaking_task";
    update((prev) => ({ ...prev, questions: [...prev.questions, newQuestion(number, type, auto)] }));
  }

  function handleDeleteGroup() {
    setConfirmDelete(true);
  }

  const serverAudio = `/api/backend/mock/groups/${group.id}/audio`;
  const serverImage = `/api/backend/mock/groups/${group.id}/image`;
  const allowedTypes = TYPES_BY_SKILL[skill];

  return (
    <div className="space-y-4">
      {errors.length > 0 && (
        <div className="rounded-[8px] border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
          <ul className="list-disc space-y-0.5 pl-4">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Material */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>
              {part.title.trim() || `${meta.unit} · ${tx(t, "material", "material")}`}
            </CardTitle>
            <Badge variant="info" className="capitalize">
              {skill}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={tx(t, "blockTitle", "Block title")} htmlFor="ge-title" className="sm:col-span-2">
              <Input
                id="ge-title"
                value={part.title}
                onChange={(e) => update((p) => ({ ...p, title: e.target.value }))}
                placeholder={tx(t, "blockTitleHint", "e.g. Questions 1–5 — Complete the notes")}
              />
            </Field>
            {skill === "listening" && (
              <Field label={tx(t, "partNo", "Part number")} htmlFor="ge-partno">
                <Input
                  id="ge-partno"
                  type="number"
                  min={1}
                  max={4}
                  value={part.partNumber ?? ""}
                  onChange={(e) =>
                    update((p) => ({
                      ...p,
                      partNumber: e.target.value === "" ? undefined : Number(e.target.value),
                    }))
                  }
                />
              </Field>
            )}
          </div>

          <Field label={tx(t, "instructions", "Instructions")} htmlFor="ge-instr">
            <Textarea
              id="ge-instr"
              value={part.instructions}
              onChange={(e) => update((p) => ({ ...p, instructions: e.target.value }))}
              className="min-h-20"
              placeholder={tx(t, "instrHint", "e.g. Complete the notes below. Write ONE WORD AND/OR A NUMBER.")}
            />
          </Field>

          {skill === "reading" && (
            <Field
              label={tx(t, "passage", "Reading passage")}
              hint={tx(t, "passageHint", "The text students read. Questions below belong to it.")}
              htmlFor="ge-passage"
            >
              <Textarea
                id="ge-passage"
                value={part.passageText}
                onChange={(e) => update((p) => ({ ...p, passageText: e.target.value }))}
                className="min-h-40 font-serif"
              />
            </Field>
          )}
          {(skill === "writing" || skill === "speaking") && (
            <Field
              label={tx(t, "taskMaterial", "Task material (optional)")}
              hint={tx(t, "taskMaterialHint", "Extra chart description, bullet points or context.")}
              htmlFor="ge-passage"
            >
              <Textarea
                id="ge-passage"
                value={part.passageText}
                onChange={(e) => update((p) => ({ ...p, passageText: e.target.value }))}
                className="min-h-24"
              />
            </Field>
          )}

          {/* Audio belongs to the block */}
          <div className="rounded-[8px] border border-border p-3">
            <p className="text-sm font-semibold text-fg">
              <Music className="mr-1.5 inline size-4" />
              {tx(t, "audio", "Audio")} {skill !== "listening" && <span className="font-normal text-fg-subtle">{tx(t, "optional", "(optional)")}</span>}
            </p>
            {(group.hasAudio || part.audioPendingFile) && !localAudioUrl && (
              <audio controls preload="none" src={serverAudio} className="mt-2 h-9 w-full" />
            )}
            {localAudioUrl && (
              <audio controls preload="metadata" src={localAudioUrl} className="mt-2 h-9 w-full" />
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                ref={audioRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  if (localAudioUrl) URL.revokeObjectURL(localAudioUrl);
                  setLocalAudioUrl(URL.createObjectURL(f));
                  update((p) => ({ ...p, audioPendingFile: f, audioFileName: f.name, hasAudio: true }));
                }}
              />
              <Button size="sm" variant="outline" onClick={() => audioRef.current?.click()}>
                <Upload className="size-4" />
                {group.hasAudio || part.audioPendingFile
                  ? tx(t, "replaceAudio", "Replace audio")
                  : tx(t, "uploadAudio", "Upload audio")}
              </Button>
              {(part.audioFileName || part.audioDurationSec != null) && (
                <span className="text-xs text-fg-muted">
                  {part.audioFileName}
                  {part.audioDurationSec != null && ` · ${fmtDuration(part.audioDurationSec)}`}
                </span>
              )}
              <div className="ml-auto flex items-center gap-2">
                <Field label={tx(t, "playLimit", "Plays")} htmlFor="ge-plays" className="w-20">
                  <Input
                    id="ge-plays"
                    type="number"
                    min={1}
                    max={10}
                    value={part.audioPlayLimit}
                    onChange={(e) => {
                      const n = Math.min(10, Math.max(1, Math.floor(Number(e.target.value) || 1)));
                      update((p) => ({ ...p, audioPlayLimit: n }));
                    }}
                  />
                </Field>
              </div>
            </div>
            <p className="mt-1.5 text-[11px] text-fg-subtle">
              {tx(t, "audioHint", "One audio per block. In Full Mock timed mode each student hears it once.")}
            </p>
          </div>

          {/* Image / diagram */}
          <div className="rounded-[8px] border border-border p-3">
            <p className="text-sm font-semibold text-fg">
              <ImagePlus className="mr-1.5 inline size-4" />
              {tx(t, "image", "Diagram / image")} <span className="font-normal text-fg-subtle">{tx(t, "optional", "(optional)")}</span>
            </p>
            {(group.imageUrl || localImageUrl) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={localImageUrl ?? serverImage}
                alt=""
                className="mt-2 max-h-48 rounded-[8px] border border-border"
              />
            )}
            <div className="mt-2">
              <input
                ref={imageRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  if (localImageUrl) URL.revokeObjectURL(localImageUrl);
                  setLocalImageUrl(URL.createObjectURL(f));
                  setImageFile(f);
                }}
              />
              <Button size="sm" variant="outline" onClick={() => imageRef.current?.click()}>
                <Upload className="size-4" />
                {group.imageUrl || imageFile ? tx(t, "replaceImage", "Replace image") : tx(t, "uploadImage", "Upload image")}
              </Button>
              {imageFile && <span className="ml-2 text-xs text-fg-muted">{imageFile.name}</span>}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" loading={saving} onClick={() => void save()}>
              <Save className="size-4" />
              {tc("save")}
            </Button>
            <Button
              size="sm"
              variant="danger"
              loading={delGroup.isPending}
              onClick={handleDeleteGroup}
              className="ml-auto"
            >
              <Trash2 className="size-4" />
              {tx(t, "deleteBlock", "Delete block")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-fg">
          {tx(t, "questionsTitle", "Questions")} ({part.questions.length})
        </h3>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowPreview((v) => !v)}>
            {showPreview ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {tx(t, "preview", "Preview")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowImport((v) => !v)}>
            <Upload className="size-4" />
            {tx(t, "import", "Import")}
          </Button>
          <Button size="sm" variant="outline" onClick={addQuestion}>
            <Plus className="size-4" />
            {tx(t, "addQuestion", "Add question")}
          </Button>
        </div>
      </div>

      {showPreview && <StudentPreview group={previewGroup(part, group)} skill={skill} />}

      {showImport && (
        <ImportPanel
          examId={examId}
          groupId={group.id}
          skill={skill}
          onDone={(added) => {
            setShowImport(false);
            if (!added || added.length === 0 || !group) return;
            const have = new Set(group.questions.map((q) => q.id));
            const merged = added
              .filter((q) => q && typeof q.id === "string" && !have.has(q.id))
              .map((q) => ({
                clientId: q.id,
                number: q.number,
                type: q.type as typeof part.questions[number]["type"],
                prompt: q.prompt ?? "",
                options: q.options ?? [],
                correctAnswers: q.correctAnswers ?? [],
                acceptedVariants: q.acceptedVariants ?? [],
                points: q.points ?? 1,
                wordLimit: q.wordLimit ?? undefined,
                savedQuestionId: q.id,
              }));
            if (merged.length === 0) return;
            update((prev) => ({ ...prev, questions: [...prev.questions, ...merged] }));
          }}
          groupLabel={`${skill.charAt(0).toUpperCase() + skill.slice(1)} → ${part.title.trim() || meta.unit}`}
          existingNumbers={detail.sections.flatMap((s) => s.groups.flatMap((g) => g.questions.map((q) => q.number)))}
        />
      )}

      {part.questions.length === 0 ? (
        <Card>
          <CardContent className="space-y-2 p-5">
            <p className="text-sm font-semibold text-fg">
              {part.title.trim() || meta.unit} {tx(t, "noQuestionsTitle", "has no questions yet.")}
            </p>
            <p className="text-sm text-fg-muted">
              {tx(
                t,
                "noQuestionsWhy",
                "Questions belong to this block and are numbered across the whole exam. Add one manually, or paste many at once with Import.",
              )}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={addQuestion}>
                <Plus className="size-4" />
                {tx(t, "addQuestion", "Add question")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>
                <Upload className="size-4" />
                {tx(t, "import", "Import")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {part.questions.map((q) => (
            <QuestionEditor
              key={q.clientId}
              question={q}
              skill={skill}
              allowedTypes={allowedTypes}
              onChange={(next) =>
                update((p) => ({
                  ...p,
                  questions: p.questions.map((x) => (x.clientId === q.clientId ? next : x)),
                }))
              }
              onRemove={() =>
                update((p) => ({ ...p, questions: p.questions.filter((x) => x.clientId !== q.clientId) }))
              }
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={`${tx(t, "deleteBlock", "Delete block")} — “${part.title.trim() || meta.unit}”?`}
        description={tx(
          t,
          "deleteBlockConfirm",
          `Delete this block and all its questions? This will remove ${part.questions.length} ${part.questions.length === 1 ? "question" : "questions"}.`,
        )}
        confirmLabel={tx(t, "deleteBlock", "Delete block")}
        loading={delGroup.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          delGroup.mutate(group.id, {
            onSuccess: () => {
              toast.success(tx(t, "deletedGeneric", "Deleted"));
              onSelect({ kind: "section", sectionId });
            },
            onError: (e) => toast.error(e instanceof ApiError ? e.message : tc("unknownError")),
          })
        }
      />
    </div>
  );
}

/** Server group shape for the read-only student preview (local edits applied). */
function previewGroup(
  part: BuilderPart,
  server: { id: string; hasAudio: boolean; imageUrl: string | null },
) {
  return {
    id: server.id,
    title: part.title,
    instructions: part.instructions,
    passageText: part.passageText,
    hasAudio: part.hasAudio || server.hasAudio,
    imageUrl: server.imageUrl,
    questions: part.questions.map((q) => ({
      id: q.clientId,
      number: q.number,
      type: q.type,
      prompt: q.prompt || "(empty question)",
      options: q.options,
      points: q.points,
      wordLimit: q.wordLimit ?? null,
    })),
  };
}
