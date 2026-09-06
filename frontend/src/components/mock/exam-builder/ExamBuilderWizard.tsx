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
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAddMockQuestions,
  useCreateMockExam,
  useCreateMockGroup,
  useCreateMockSection,
  useDeleteMockQuestion,
  useMockExam,
  useSetMockGroupMedia,
  useUpdateMockExam,
  useUpdateMockGroup,
  useUpdateMockQuestion,
} from "@/hooks/use-mock";
import { ApiError } from "@/lib/api-client";
import type { MockExamDetail, MockExamType, MockSkill } from "@/lib/types";
/* Builder shape + part editors are owned by parallel agents (A1 / part agents). */
import type { BuilderDraft, BuilderPart, BuilderQuestion, BuilderSection } from "./types";
import { validatePart } from "./types";
import { ListeningPart } from "./ListeningPart";
import { ReadingPart } from "./ReadingPart";
import { SpeakingPart, WritingPart } from "./OtherParts";
import { ReviewStep } from "./ReviewStep";

const SKILLS: MockSkill[] = ["listening", "reading", "writing", "speaking"];
const TYPES: MockExamType[] = ["ielts_academic", "ielts_general", "multilevel"];

/* ── A4: PartHost — renders the real part editor for the section skill ──── */

export function PartHost({
  section,
  partIndex,
  onChange,
}: {
  section: BuilderSection;
  partIndex: number;
  onChange: (part: BuilderPart) => void;
}) {
  const tm = useTranslations("mock");
  const part = section.parts?.[partIndex];
  if (!part) return null;
  const partLabel = `${tm(`skills.${section.skill}`)} · ${partIndex + 1}`;

  switch (section.skill) {
    case "listening":
      return <ListeningPart part={part} partLabel={partLabel} onChange={onChange} />;
    case "reading":
      return <ReadingPart part={part} partLabel={partLabel} onChange={onChange} />;
    case "writing":
      return (
        <WritingPart
          part={part}
          partLabel={partLabel}
          onChange={onChange}
          taskKind={partIndex === 0 ? "task1" : "task2"}
        />
      );
    case "speaking":
      return <SpeakingPart part={part} partLabel={partLabel} onChange={onChange} />;
    default:
      return null;
  }
}

/* ── Wizard shell (A1 owns draft state + saving; A4 adds PartHost/review) ── */

export function ExamBuilderWizard({
  open,
  examId,
  onClose,
  onCreated,
}: {
  open: boolean;
  examId: string | null;
  onClose: () => void;
  onCreated: (examId: string) => void;
}) {
  const tm = useTranslations("mock");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{examId ? tm("manage") : tm("create")}</DialogTitle>
        </DialogHeader>
        {open && <WizardBody examId={examId} onClose={onClose} onCreated={onCreated} />}
      </DialogContent>
    </Dialog>
  );
}

/** Server detail (sections → groups) mapped onto the builder draft shape. */
function toBuilderDraft(detail: MockExamDetail): BuilderDraft {
  const sections: BuilderSection[] = detail.sections.map((s) => ({
    skill: s.skill,
    title: s.title ?? "",
    durationMinutes: s.durationMinutes ?? undefined,
    instructions: s.instructions ?? "",
    savedSectionId: s.id,
    parts: s.groups.map((g): BuilderPart => ({
      clientId: g.id,
      title: g.title ?? "",
      instructions: g.instructions ?? "",
      passageText: g.passageText ?? "",
      partNumber: g.partNumber ?? undefined,
      audioFileName: undefined,
      audioPendingFile: null,
      audioDurationSec: g.audioDurationSec ?? undefined,
      audioPlayLimit: g.audioPlayLimit ?? 1,
      hasAudio: g.hasAudio,
      savedGroupId: g.id,
      questions: g.questions.map(
        (q): BuilderQuestion => ({
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
        }),
      ),
    })),
  }));
  return {
    examId: detail.id,
    title: detail.title,
    type: detail.type,
    level: detail.level ?? "",
    price: 0,
    sections,
  };
}

function WizardBody({
  examId,
  onClose,
  onCreated,
}: {
  examId: string | null;
  onClose: () => void;
  onCreated: (examId: string) => void;
}) {
  const t = useTranslations("mock");
  const tc = useTranslations("common");

  const [id, setId] = React.useState<string | null>(examId);
  const [rev, setRev] = React.useState(0);
  const detailQ = useMockExam(id ?? "");
  const [draft, setDraft] = React.useState<BuilderDraft | null>(null);
  const [mode, setMode] = React.useState<"parts" | "review">("parts");
  const [cursor, setCursor] = React.useState(0);
  const [newSkill, setNewSkill] = React.useState<MockSkill>("listening");

  const createSection = useCreateMockSection(id ?? "");
  const createGroup = useCreateMockGroup(id ?? "");
  const updateGroup = useUpdateMockGroup(id ?? "");
  const addQuestions = useAddMockQuestions(id ?? "");
  const updateQuestion = useUpdateMockQuestion(id ?? "");
  const deleteQuestion = useDeleteMockQuestion(id ?? "");
  const setMedia = useSetMockGroupMedia(id ?? "");
  const update = useUpdateMockExam(id ?? "");
  const [partErrors, setPartErrors] = React.useState<string[]>([]);
  const [savingPart, setSavingPart] = React.useState(false);

  /* Draft follows the server detail; rev re-syncs after structural adds.
     Render-time sync (React recommended over setState-in-effect). */
  const dataKey = `${id}:${rev}:${detailQ.dataUpdatedAt}`;
  const [syncedKey, setSyncedKey] = React.useState<string>("");
  if (detailQ.data && dataKey !== syncedKey) {
    setSyncedKey(dataKey);
    setDraft(toBuilderDraft(detailQ.data));
  }

  const steps = React.useMemo(() => {
    const list: { section: number; part: number }[] = [];
    (draft?.sections ?? []).forEach((s, si) => {
      (s.parts ?? []).forEach((_, pi) => list.push({ section: si, part: pi }));
    });
    return list;
  }, [draft]);

  if (!id) {
    return <WizardSetup onClose={onClose} onCreatedId={(newId) => setId(newId)} />;
  }
  if (detailQ.isLoading || !draft) {
    return (
      <DialogBody>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </DialogBody>
    );
  }
  if (detailQ.isError) {
    return (
      <DialogBody>
        <ErrorState
          title={tc("error")}
          action={
            <Button variant="outline" size="sm" onClick={() => detailQ.refetch()}>
              {tc("retry")}
            </Button>
          }
        />
      </DialogBody>
    );
  }

  /* A4: after the last part, render ReviewStep instead of finishing. */
  if (mode === "review") {
    return (
      <DialogBody>
        <ReviewStep
          draft={draft}
          onPublish={() => {
            update.mutate(
              { isPublished: true },
              {
                onSuccess: (exam) => {
                  toast.success(tc("saved"));
                  onCreated(exam.id);
                },
                onError: (e) => toast.error(e instanceof ApiError ? e.message : tc("unknownError")),
              },
            );
          }}
          publishing={update.isPending}
          onBack={() => setMode("parts")}
        />
      </DialogBody>
    );
  }

  const safeCursor = Math.min(cursor, Math.max(steps.length - 1, 0));
  const current = steps[safeCursor] ?? null;
  const currentSection = current != null ? (draft.sections?.[current.section] ?? null) : null;

  function handlePartChange(sectionIdx: number, partIdx: number, next: BuilderPart) {
    setDraft((d) => {
      if (!d || !d.sections) return d;
      return {
        ...d,
        sections: d.sections.map((s, si) =>
          si === sectionIdx
            ? { ...s, parts: (s.parts ?? []).map((p, pi) => (pi === partIdx ? next : p)) }
            : s,
        ),
      };
    });
  }

  function handleAddSection() {
    if (!draft) return;
    createSection.mutate(
      { skill: newSkill, sortOrder: draft.sections?.length ?? 0 },
      {
        onSuccess: () => setRev((r) => r + 1),
        onError: () => toast.error(tc("unknownError")),
      },
    );
  }

  function handleAddPart() {
    const serverSections = detailQ.data?.sections;
    if (!serverSections || !draft) return;
    const si = current?.section ?? serverSections.length - 1;
    const serverSection = serverSections[si];
    const localSection = draft.sections?.[si];
    if (!serverSection || !localSection) return;
    createGroup.mutate(
      {
        sectionId: serverSection.id,
        input: {
          partNumber: (localSection.parts?.length ?? 0) + 1,
          sortOrder: localSection.parts?.length ?? 0,
        },
      },
      {
        onSuccess: () => setRev((r) => r + 1),
        onError: () => toast.error(tc("unknownError")),
      },
    );
  }

  /** Joriy partni saqlash (validate → group update → questions reconcile → media) va keyingisiga o'tish. */
  async function saveCurrentPart(goReview: boolean) {
    if (!draft || !current || !currentSection) return;
    const part = currentSection.parts[current.part];
    if (!part) return;
    const errors = validatePart(currentSection.skill, part);
    setPartErrors(errors);
    if (errors.length > 0) return;
    const groupId = part.savedGroupId;
    if (!groupId) {
      setPartErrors(["Block is not saved yet — add it first"]);
      return;
    }
    setSavingPart(true);
    try {
      await updateGroup.mutateAsync({
        groupId,
        input: {
          title: part.title.trim() || undefined,
          instructions: part.instructions.trim() || undefined,
          passageText: part.passageText.trim() || undefined,
          partNumber: part.partNumber,
          audioDurationSec: part.audioDurationSec,
          audioPlayLimit: part.audioPlayLimit,
        },
      });

      // O'chirilgan saqlangan savollarni tozalash (server snapshot bilan solishtirib).
      const serverGroup = detailQ.data?.sections
        .flatMap((s) => s.groups)
        .find((g) => g.id === groupId);
      const liveIds = new Set(part.questions.map((q) => q.savedQuestionId).filter(Boolean));
      const removed = (serverGroup?.questions ?? [])
        .map((q) => q.id)
        .filter((qid) => !liveIds.has(qid));
      for (const qid of removed) {
        await deleteQuestion.mutateAsync(qid);
      }

      // Yangilangan saqlangan savollar (hammasini yuborish — arzonga tushadi, xavfsiz).
      for (const q of part.questions) {
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

      // Yangi savollar — bitta bulk so'rov.
      const fresh = part.questions.filter((q) => !q.savedQuestionId);
      if (fresh.length > 0) {
        const res = await addQuestions.mutateAsync({
          groupId,
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
        const returned = (res as unknown as { questions?: Array<{ id: string; number: number }> })
          .questions;
        // Backend sortOrder bo'yicha qaytaradi — yangilar oxirida, yuborilgan tartibda.
        const newIds = (returned ?? []).slice(-fresh.length).map((q) => q.id);
        const freshStart = part.questions.length - fresh.length;
        setDraft((d) => {
          if (!d) return d;
          return {
            ...d,
            sections: d.sections.map((s, si) =>
              si === current.section
                ? {
                    ...s,
                    parts: s.parts.map((p, pi) => {
                      if (pi !== current.part) return p;
                      return {
                        ...p,
                        questions: p.questions.map((q, qi) => {
                          if (q.savedQuestionId) return q;
                          const nid = newIds[qi - freshStart];
                          return nid ? { ...q, savedQuestionId: nid } : q;
                        }),
                      };
                    }),
                  }
                : s,
            ),
          };
        });
      }

      // Kutilayotgan audio.
      if (part.audioPendingFile) {
        const form = new FormData();
        form.append("audio", part.audioPendingFile);
        await setMedia.mutateAsync({ groupId, form });
        const audioName = part.audioPendingFile?.name;
        setDraft((d) => {
          if (!d) return d;
          return {
            ...d,
            sections: d.sections.map((s, si) => {
              if (si !== current.section) return s;
              return {
                ...s,
                parts: s.parts.map((p, pi) => {
                  if (pi !== current.part) return p;
                  return { ...p, audioPendingFile: null, hasAudio: true, audioFileName: audioName };
                }),
              };
            }),
          };
        });
      }

      toast.success(tc("saved"));
      setPartErrors([]);
      if (goReview) setMode("review");
      else setCursor(safeCursor + 1);
    } catch (e) {
      setPartErrors([e instanceof ApiError ? e.message : tc("unknownError")]);
    } finally {
      setSavingPart(false);
    }
  }

  return (
    <>
      <DialogBody className="space-y-4">
        {partErrors.length > 0 && (
          <div className="rounded-[8px] border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
            <ul className="list-disc space-y-0.5 pl-4">
              {partErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        {steps.length === 0 ? (
          <p className="text-sm text-fg-muted">{t("authoringHint")}</p>
        ) : (
          current &&
          currentSection && (
            <PartHost
              section={currentSection}
              partIndex={current.part}
              onChange={(p) => handlePartChange(current.section, current.part, p)}
            />
          )
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={newSkill} onValueChange={(v) => setNewSkill(v as MockSkill)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SKILLS.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`skills.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" loading={createSection.isPending} onClick={handleAddSection}>
            {tc("add")} · {t(`skills.${newSkill}`)}
          </Button>
          <Button variant="outline" size="sm" loading={createGroup.isPending} onClick={handleAddPart}>
            {tc("add")} · {t("block")}
          </Button>
        </div>
      </DialogBody>
      <DialogFooter className="sm:justify-between">
        <Button
          variant="outline"
          onClick={() => (safeCursor === 0 ? onClose() : setCursor(safeCursor - 1))}
        >
          {tc("back")}
        </Button>
        {steps.length > 0 && safeCursor < steps.length - 1 ? (
          <Button loading={savingPart} onClick={() => void saveCurrentPart(false)}>
            {tc("save")} · {tc("next")}
          </Button>
        ) : (
          <Button loading={savingPart} onClick={() => void saveCurrentPart(true)} disabled={steps.length === 0}>
            {tc("save")} · Review
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

/** First step of a fresh (examId === null) wizard: create the exam shell. */
function WizardSetup({
  onClose,
  onCreatedId,
}: {
  onClose: () => void;
  onCreatedId: (id: string) => void;
}) {
  const t = useTranslations("mock");
  const tc = useTranslations("common");
  const tw = useTranslations("wizard");
  const create = useCreateMockExam();

  const [type, setType] = React.useState<MockExamType>("ielts_academic");
  const [title, setTitle] = React.useState("");
  const [level, setLevel] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  function submit() {
    setError(null);
    // Raqamlar ruxsat — faqat minimal uzunlik tekshiriladi (backend: min 3).
    if (title.trim().length < 3) return setError(tw("titleTooShort"));
    create.mutate(
      {
        type,
        title: title.trim(),
        level: level.trim() || undefined,
        price: price ? Number(price) : undefined,
      },
      {
        onSuccess: (exam) => {
          toast.success(tc("saved"));
          onCreatedId(exam.id);
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
        <Field label={tc("name")} hint={tw("examTitleHint")} htmlFor="wtitle">
          <Input
            id="wtitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="IELTS Mock 1"
            autoFocus
          />
        </Field>
        <Field label="Type">
          <Select value={type} onValueChange={(v) => setType(v as MockExamType)}>
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("cefrLevel")} htmlFor="wlevel">
            <Input
              id="wlevel"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              placeholder="Academic / B1-B2"
            />
          </Field>
          <Field label={tc("sum")} htmlFor="wprice">
            <Input
              id="wprice"
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
            />
          </Field>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {tc("cancel")}
        </Button>
        <Button onClick={submit} loading={create.isPending}>
          {tc("add")}
        </Button>
      </DialogFooter>
    </>
  );
}
