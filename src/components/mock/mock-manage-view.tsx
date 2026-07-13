"use client";

import * as React from "react";
import { ArrowLeft, Check, FileQuestion, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { useMe } from "@/hooks/use-me";
import { useDeleteMockExam, useMockExam, useUpdateMockExam } from "@/hooks/use-mock";
import { cn } from "@/lib/utils";

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
  const { data: me } = useMe();
  const examQ = useMockExam(examId);
  const update = useUpdateMockExam(examId);
  const del = useDeleteMockExam();

  const exam = examQ.data;
  const [form, setForm] = React.useState({ title: "", level: "", price: "" });
  const [flags, setFlags] = React.useState({ isPublished: false, isDemo: false, isFreeForApproved: true });

  React.useEffect(() => {
    if (exam) {
      setForm({ title: exam.title, level: exam.level ?? "", price: String(exam.price) });
      setFlags({
        isPublished: exam.isPublished,
        isDemo: exam.isDemo,
        isFreeForApproved: exam.isFreeForApproved,
      });
    }
  }, [exam]);

  function save() {
    update.mutate(
      {
        title: form.title.trim(),
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
    del.mutate(examId, {
      onSuccess: () => {
        toast.success(tc("saved"));
        router.push("/mock");
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
      </div>

      {/* Sozlamalar */}
      <Card>
        <CardContent className="space-y-4 pt-5">
          <Field label={tc("name")} htmlFor="title">
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
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

      {/* Tuzilma */}
      <h2 className="mt-6 mb-3 text-sm font-semibold text-fg-muted">{t("sections")}</h2>
      {exam.sections.length === 0 ? (
        <EmptyState icon={FileQuestion} title={t("noSections")} />
      ) : (
        <div className="space-y-3">
          {exam.sections.map((sec) => (
            <Card key={sec.id} className="p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-fg">
                  {t(`skills.${sec.skill}`)}
                  {sec.durationMinutes ? (
                    <span className="ml-2 text-xs font-normal text-fg-muted">
                      {sec.durationMinutes} {t("minutes")}
                    </span>
                  ) : null}
                </p>
                <span className="text-xs text-fg-muted">
                  {sec.groups.reduce((g, grp) => g + grp.questions.length, 0)} {t("questions")}
                </span>
              </div>
              {sec.groups.map((grp) => (
                <div key={grp.id} className="mt-3 rounded-[8px] border border-border bg-bg-subtle p-3">
                  <p className="text-sm font-medium text-fg">
                    {grp.title ?? t("block")}
                    {grp.hasAudio && <span className="ml-2 text-xs text-brand">♪ audio</span>}
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {grp.questions.map((q) => (
                      <li key={q.id} className="flex items-start gap-2 text-xs text-fg-muted">
                        <span className="font-semibold text-fg tabular-nums">{q.number}.</span>
                        <span className="line-clamp-1">{q.prompt}</span>
                        <span className="ml-auto shrink-0 rounded bg-surface px-1.5 font-mono text-[10px] text-fg-subtle">
                          {q.type}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </Card>
          ))}
        </div>
      )}
      <p className="mt-4 text-center text-xs text-fg-subtle">{t("authoringHint")}</p>
    </div>
  );
}
