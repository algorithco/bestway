"use client";

import * as React from "react";
import { ArrowLeft, Check, Copy, Eye, FileQuestion, Plus, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { useMe } from "@/hooks/use-me";
import {
  useCloneMockExam,
  useCreateMockGroup,
  useDeleteMockExam,
  useDeleteMockGroup,
  useDeleteMockQuestion,
  useDeleteMockSection,
  useMockExam,
  useMockPreview,
  useMockReadiness,
  useSetMockGroupMedia,
  useUpdateMockExam,
  useUpdateMockGroup,
} from "@/hooks/use-mock";
import { ApiError } from "@/lib/api-client";
import type { MockExamDetail, MockGroup, MockSkill } from "@/lib/types";
import { displayTotalMinutes } from "@/lib/mock-timing";
import { cn } from "@/lib/utils";
import { MockQuestionsDialog } from "@/components/mock/mock-questions-dialog";
import { MockSectionDialog } from "@/components/mock/mock-section-dialog";

/** Kichik on/off tugma — alohida Switch komponenti yo'q */
function Toggle({
  on,
  onClick,
  label,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "inline-flex items-center gap-2 rounded-[8px] border px-3 py-2 text-sm font-medium transition-colors",
        on
          ? "border-brand bg-brand-subtle text-brand-subtle-fg"
          : "border-border bg-surface text-fg-muted hover:bg-surface-hover",
      )}
    >
      <span
        className={cn(
          "grid size-4 place-items-center rounded-full border",
          on ? "border-brand bg-brand text-white" : "border-border",
        )}
      >
        {on && <Check className="size-3" />}
      </span>
      {label}
    </button>
  );
}

export function MockManageView({ examId }: { examId: string }) {
  const t = useTranslations("mock");
  const tc = useTranslations("common");
  const router = useRouter();
  const examQ = useMockExam(examId);
  const clone = useCloneMockExam();

  const [sectionOpen, setSectionOpen] = React.useState(false);
  const [qDialog, setQDialog] = React.useState<{ groupId: string; skill: MockSkill } | null>(null);
  const [groupDialog, setGroupDialog] = React.useState<{ sectionId: string; group?: MockGroup; skill: MockSkill } | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  const exam = examQ.data;

  function onClone() {
    if (!confirm("Clone this exam to your drafts?")) return;
    clone.mutate(examId, {
      onSuccess: (res) => {
        toast.success(tc("saved"));
        router.push(`/mock/${res.id}`);
      },
      onError: () => toast.error(tc("unknownError")),
    });
  }

  if (examQ.isError) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState
          title={tc("error")}
          action={
            <Button variant="outline" size="sm" onClick={() => examQ.refetch()}>
              {tc("retry")}
            </Button>
          }
        />
      </div>
    );
  }
  if (examQ.isLoading || !exam) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/mock"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" />
        {t("title")}
      </Link>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant="info">{t(`types.${exam.type}`)}</Badge>
        <Badge variant={exam.isPublished ? "success" : "warning"}>
          {exam.isPublished ? t("published") : t("draft")}
        </Badge>
        <span className="text-sm text-fg-muted">
          {exam.questionCount} {t("questions")}
        </span>
        <span className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
            <Eye />
            Preview
          </Button>
          <Button size="sm" variant="outline" loading={clone.isPending} onClick={onClone}>
            <Copy />
            Clone
          </Button>
          <Button size="sm" onClick={() => setSectionOpen(true)}>
            <Plus />
            {t("addSection")}
          </Button>
        </span>
      </div>

      {/* Sozlamalar */}
      <ManageSettingsCard
        key={`${exam.title}|${exam.description ?? ""}|${exam.level ?? ""}|${exam.price}|${exam.isPublished}|${exam.isDemo}|${exam.isFreeForApproved}`}
        exam={exam}
      />

      {exam.isPublished && (
        <p className="mt-3 rounded-[8px] border border-warning-border bg-warning-bg px-3 py-2 text-xs text-warning">
          Published — edits affect live students immediately. Unpublish first for structural changes.
        </p>
      )}

      {/* Nashr-readiness */}
      <ReadinessPanel examId={exam.id} />

      {/* Tuzilma */}
      <h2 className="mt-6 mb-3 text-sm font-semibold text-fg-muted">{t("sections")}</h2>
      {exam.sections.length === 0 ? (
        <EmptyState icon={FileQuestion} title={t("noSections")} />
      ) : (
        <div className="space-y-3">
          {exam.sections.map((sec) => (
            <SectionCard
              key={sec.id}
              examId={exam.id}
              sectionId={sec.id}
              skill={sec.skill}
              title={sec.title}
              durationMinutes={sec.durationMinutes}
              groups={sec.groups}
              onAddGroup={() => setGroupDialog({ sectionId: sec.id, skill: sec.skill })}
              onEditGroup={(group) => setGroupDialog({ sectionId: sec.id, group, skill: sec.skill })}
              onAddQuestions={(groupId) => setQDialog({ groupId, skill: sec.skill })}
            />
          ))}
        </div>
      )}

      <MockSectionDialog
        examId={exam.id}
        existing={exam.sections.map((s) => s.skill)}
        open={sectionOpen}
        onClose={() => setSectionOpen(false)}
      />
      {qDialog && (
        <MockQuestionsDialog
          examId={exam.id}
          groupId={qDialog.groupId}
          skill={qDialog.skill}
          open
          onClose={() => setQDialog(null)}
        />
      )}
      {groupDialog && (
        <MockGroupDialog
          examId={exam.id}
          sectionId={groupDialog.sectionId}
          group={groupDialog.group}
          skill={groupDialog.skill}
          open
          onClose={() => setGroupDialog(null)}
        />
      )}
      {previewOpen && (
        <PreviewDialog examId={exam.id} open onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  );
}

function SectionCard({
  examId,
  sectionId,
  skill,
  title,
  durationMinutes,
  groups,
  onAddGroup,
  onEditGroup,
  onAddQuestions,
}: {
  examId: string;
  sectionId: string;
  skill: MockSkill;
  title: string | null;
  durationMinutes: number | null;
  groups: MockGroup[];
  onAddGroup: () => void;
  onEditGroup: (group: MockGroup) => void;
  onAddQuestions: (groupId: string) => void;
}) {
  const t = useTranslations("mock");
  const tc = useTranslations("common");
  const delSection = useDeleteMockSection(examId);
  const delGroup = useDeleteMockGroup(examId);
  const delQuestion = useDeleteMockQuestion(examId);
  const media = useSetMockGroupMedia(examId);
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const [mediaGroup, setMediaGroup] = React.useState<string | null>(null);

  function onDeleteSection() {
    if (!confirm(tc("delete") + "?")) return;
    delSection.mutate(sectionId, {
      onSuccess: () => toast.success(tc("saved")),
      onError: () => toast.error(tc("unknownError")),
    });
  }

  function pickMedia(groupId: string) {
    setMediaGroup(groupId);
    fileRef.current?.click();
  }

  function onMediaFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !mediaGroup) return;
    const form = new FormData();
    if (file.type.startsWith("audio/")) form.append("audio", file);
    else if (file.type.startsWith("image/")) form.append("image", file);
    else return toast.error(tc("unknownError"));
    media.mutate(
      { groupId: mediaGroup, form },
      {
        onSuccess: () => toast.success(tc("saved")),
        onError: (err) => toast.error(err instanceof ApiError ? err.message : tc("unknownError")),
      },
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-fg">
          {title ?? t(`skills.${skill}`)}
          {/* Listening minutes are audio-derived (never the stored field);
              other skills show the stored value when present. */}
          {skill === "listening"
            ? (() => {
                const m = displayTotalMinutes([{ skill, groups }]);
                return m != null ? (
                  <span className="ml-2 text-xs font-normal text-fg-muted">
                    {m} {t("minutes")}
                  </span>
                ) : null;
              })()
            : durationMinutes ? (
              <span className="ml-2 text-xs font-normal text-fg-muted">
                {durationMinutes} {t("minutes")}
              </span>
            ) : null}
        </p>
        <span className="flex items-center gap-2">
          <span className="text-xs text-fg-muted">
            {groups.reduce((g, grp) => g + grp.questions.length, 0)} {t("questions")}
          </span>
          <Button size="sm" variant="outline" onClick={onAddGroup}>
            <Plus />
            Block
          </Button>
          <Button
            size="sm"
            variant="ghost"
            loading={delSection.isPending}
            onClick={onDeleteSection}
            aria-label={tc("delete")}
          >
            <Trash2 className="text-danger" />
          </Button>
        </span>
      </div>
      {groups.map((grp) => (
        <div key={grp.id} className="mt-3 rounded-[8px] border border-border bg-bg-subtle p-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-fg">
              {grp.title ?? t("block")}
              {grp.hasAudio && <span className="ml-2 text-xs text-brand">♪ audio</span>}
              {grp.partNumber ? <span className="ml-2 text-xs text-fg-muted">Part {grp.partNumber}</span> : null}
            </p>
            <span className="ml-auto flex gap-1">
              <Button size="sm" variant="outline" onClick={() => onAddQuestions(grp.id)}>
                <Plus />
                {t("addQuestions")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => pickMedia(grp.id)} loading={media.isPending && mediaGroup === grp.id}>
                <Upload />
                Media
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onEditGroup(grp)}>
                {tc("edit")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={tc("delete")}
                onClick={() => {
                  if (!confirm(tc("delete") + "?")) return;
                  delGroup.mutate(grp.id, {
                    onSuccess: () => toast.success(tc("saved")),
                    onError: () => toast.error(tc("unknownError")),
                  });
                }}
              >
                <Trash2 className="text-danger" />
              </Button>
            </span>
          </div>
          <ul className="mt-1.5 space-y-1">
            {grp.questions.map((q) => (
              <li key={q.id} className="flex items-start gap-2 text-xs text-fg-muted">
                <span className="font-semibold text-fg tabular-nums">{q.number}.</span>
                <span className="line-clamp-1">{q.prompt}</span>
                <span className="ml-auto flex shrink-0 items-center gap-1">
                  <span className="rounded bg-surface px-1.5 font-mono text-[10px] text-fg-subtle">
                    {q.type}
                  </span>
                  <button
                    type="button"
                    aria-label={tc("delete")}
                    className="rounded p-0.5 hover:bg-surface-hover"
                    onClick={() => {
                      if (!confirm(tc("delete") + "?")) return;
                      delQuestion.mutate(q.id, {
                        onSuccess: () => toast.success(tc("saved")),
                        onError: () => toast.error(tc("unknownError")),
                      });
                    }}
                  >
                    <Trash2 className="size-3 text-danger" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <input
        ref={fileRef}
        type="file"
        accept="audio/*,image/*"
        className="hidden"
        onChange={onMediaFile}
      />
    </Card>
  );
}

function MockGroupDialog({
  examId,
  sectionId,
  group,
  skill,
  open,
  onClose,
}: {
  examId: string;
  sectionId: string;
  group?: MockGroup;
  skill: MockSkill;
  open: boolean;
  onClose: () => void;
}) {
  const tc = useTranslations("common");
  const create = useCreateMockGroup(examId);
  const update = useUpdateMockGroup(examId);
  const [form, setForm] = React.useState({
    title: group?.title ?? "",
    instructions: group?.instructions ?? "",
    passageText: group?.passageText ?? "",
    partNumber: group?.partNumber != null ? String(group.partNumber) : "",
    audioDurationSec: group?.audioDurationSec != null ? String(group.audioDurationSec) : "",
    audioPlayLimit: group ? String(group.audioPlayLimit) : "1",
  });
  const [error, setError] = React.useState<string | null>(null);
  const isListening = skill === "listening";

  function submit() {
    setError(null);
    const input = {
      title: form.title.trim() || undefined,
      instructions: form.instructions.trim() || undefined,
      passageText: form.passageText.trim() || undefined,
      partNumber: form.partNumber ? Number(form.partNumber) : undefined,
      audioDurationSec: form.audioDurationSec ? Number(form.audioDurationSec) : undefined,
      audioPlayLimit: form.audioPlayLimit ? Number(form.audioPlayLimit) : undefined,
    };
    const opts = {
      onSuccess: () => {
        toast.success(tc("saved"));
        onClose();
      },
      onError: (e: unknown) => setError(e instanceof ApiError ? e.message : tc("unknownError")),
    };
    if (group) update.mutate({ groupId: group.id, input }, opts);
    else create.mutate({ sectionId, input }, opts);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{group ? tc("edit") : "Add block"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {error && (
            <div className="rounded-[8px] border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}
          <Field label={tc("name")} htmlFor="gtitle">
            <Input
              id="gtitle"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Questions 1–10"
            />
          </Field>
          <Field label="Instructions" htmlFor="ginstr">
            <Textarea
              id="ginstr"
              value={form.instructions}
              onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
              className="min-h-20"
            />
          </Field>
          <Field label="Passage text" htmlFor="gpass">
            <Textarea
              id="gpass"
              value={form.passageText}
              onChange={(e) => setForm((f) => ({ ...f, passageText: e.target.value }))}
              className="min-h-28"
            />
          </Field>
          {isListening && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Part (1–4)" htmlFor="gpart">
                <Input
                  id="gpart"
                  type="number"
                  min={1}
                  max={4}
                  value={form.partNumber}
                  onChange={(e) => setForm((f) => ({ ...f, partNumber: e.target.value }))}
                />
              </Field>
              <Field label="Audio sec" htmlFor="gdur">
                <Input
                  id="gdur"
                  type="number"
                  min={1}
                  value={form.audioDurationSec}
                  onChange={(e) => setForm((f) => ({ ...f, audioDurationSec: e.target.value }))}
                />
              </Field>
              <Field label="Play limit" htmlFor="gpl">
                <Input
                  id="gpl"
                  type="number"
                  min={1}
                  max={10}
                  value={form.audioPlayLimit}
                  onChange={(e) => setForm((f) => ({ ...f, audioPlayLimit: e.target.value }))}
                />
              </Field>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button onClick={submit} loading={create.isPending || update.isPending}>
            {tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReadinessPanel({ examId }: { examId: string }) {
  const tc = useTranslations("common");
  const q = useMockReadiness(examId);

  return (
    <Card className="mt-4 p-4">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-fg">Publish readiness</p>
        {q.data && (
          <Badge variant={q.data.ready ? "success" : "warning"}>
            {q.data.ready ? "Ready" : "Needs work"}
          </Badge>
        )}
        <Button size="sm" variant="outline" onClick={() => q.refetch()} loading={q.isFetching} className="ml-auto">
          Check
        </Button>
      </div>
      {q.data && (
        <ul className="mt-2 space-y-1">
          {q.data.items.map((it) => (
            <li key={it.key} className="flex items-center gap-2 text-xs text-fg-muted">
              <span className={it.ok ? "text-success" : "text-warning"}>{it.ok ? "✓" : "✗"}</span>
              <span className="font-mono">{it.key}</span>
              <span className="ml-auto text-right text-fg-subtle">{it.detail}</span>
            </li>
          ))}
        </ul>
      )}
      {q.isError && <p className="mt-2 text-xs text-danger">{tc("error")}</p>}
    </Card>
  );
}

function PreviewDialog({
  examId,
  open,
  onClose,
}: {
  examId: string;
  open: boolean;
  onClose: () => void;
}) {
  const tc = useTranslations("common");
  const q = useMockPreview(examId, open);
  const data = q.data as unknown as {
    sections?: Array<{
      id: string;
      skill: string;
      groups?: Array<{ id: string; title: string | null; questions?: Array<{ id: string; number: number; prompt: string }> }>;
    }>;
    access?: string;
  } | undefined;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Student preview {data?.access ? `(${data.access})` : ""}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {q.isLoading && <Skeleton className="h-40" />}
          {q.isError && <p className="text-sm text-danger">{tc("error")}</p>}
          {data && (
            <div className="max-h-[50vh] space-y-3 overflow-y-auto">
              {(data.sections ?? []).map((s) => (
                <div key={s.id}>
                  <p className="text-sm font-semibold text-fg">{s.skill}</p>
                  {(s.groups ?? []).map((g) => (
                    <div key={g.id} className="mt-1 rounded border border-border p-2">
                      <p className="text-xs font-medium text-fg-muted">{g.title ?? "Block"}</p>
                      {(g.questions ?? []).slice(0, 5).map((qq) => (
                        <p key={qq.id} className="truncate text-xs text-fg-subtle">
                          {qq.number}. {qq.prompt}
                        </p>
                      ))}
                      {(g.questions ?? []).length > 5 && (
                        <p className="text-xs text-fg-subtle">… +{(g.questions ?? []).length - 5} more</p>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tc("cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageSettingsCard({ exam }: { exam: MockExamDetail }) {
  const t = useTranslations("mock");
  const tc = useTranslations("common");
  const router = useRouter();
  const { data: me } = useMe();
  const update = useUpdateMockExam(exam.id);
  const del = useDeleteMockExam();

  const [form, setForm] = React.useState({
    title: exam.title,
    description: exam.description ?? "",
    level: exam.level ?? "",
    price: String(exam.price),
  });
  const [flags, setFlags] = React.useState({
    isPublished: exam.isPublished,
    isDemo: exam.isDemo,
    isFreeForApproved: exam.isFreeForApproved,
  });

  function save() {
    update.mutate(
      {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        level: form.level.trim() || undefined,
        price: Number(form.price) || 0,
        ...flags,
      },
      {
        onSuccess: () => toast.success(tc("saved")),
        onError: () => toast.error(tc("unknownError")),
      },
    );
  }

  function onDelete() {
    if (!confirm(tc("delete") + "?")) return;
    del.mutate(exam.id, {
      onSuccess: () => {
        toast.success(tc("saved"));
        router.push("/mock");
      },
      onError: () => toast.error(tc("unknownError")),
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <Field label={tc("name")} htmlFor="title">
          <Input
            id="title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </Field>
        <Field label="Description" htmlFor="desc">
          <Textarea
            id="desc"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="min-h-20"
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("cefrLevel")} htmlFor="level">
            <Input
              id="level"
              value={form.level}
              onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
            />
          </Field>
          <Field label={tc("sum")} htmlFor="price">
            <Input
              id="price"
              type="number"
              min={0}
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Toggle
            on={flags.isPublished}
            onClick={() => setFlags((f) => ({ ...f, isPublished: !f.isPublished }))}
            label={t("published")}
          />
          <Toggle
            on={flags.isDemo}
            onClick={() => setFlags((f) => ({ ...f, isDemo: !f.isDemo }))}
            label={t("demo")}
          />
          <Toggle
            on={flags.isFreeForApproved}
            onClick={() => setFlags((f) => ({ ...f, isFreeForApproved: !f.isFreeForApproved }))}
            label={t("freeForApproved")}
          />
        </div>
        <div className="flex items-center justify-between border-t border-border pt-4">
          {me?.user.role === "super_admin" ? (
            <Button variant="ghost" size="sm" onClick={onDelete}>
              <Trash2 className="text-danger" />
              {tc("delete")}
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={save} loading={update.isPending}>
            {tc("save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
