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
import { Field, Input } from "@/components/ui/input";
import { useCreateTest, useUpdateTest } from "@/hooks/use-tests";
import { ApiError } from "@/lib/api-client";
import type { TestListItem, TestType } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPES: TestType[] = ["ielts", "multilevel"];

export function TestFormDialog({
  open,
  onClose,
  test,
}: {
  open: boolean;
  onClose: () => void;
  test?: TestListItem | null;
}) {
  const t = useTranslations("tests");
  const tc = useTranslations("common");
  const isEdit = !!test;
  const create = useCreateTest();
  const update = useUpdateTest(test?.id ?? "");
  const pending = create.isPending || update.isPending;

  const [type, setType] = React.useState<TestType>("ielts");
  const [title, setTitle] = React.useState("");
  const [level, setLevel] = React.useState("");
  const [duration, setDuration] = React.useState("");
  const [isDemo, setIsDemo] = React.useState(false);
  const [isActive, setIsActive] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setType(test?.type ?? "ielts");
    setTitle(test?.title ?? "");
    setLevel(test?.level ?? "");
    setDuration(test?.durationMinutes ? String(test.durationMinutes) : "");
    setIsDemo(test?.isDemo ?? false);
    setIsActive(test?.isActive ?? true);
  }, [open, test]);

  function submit() {
    setError(null);
    if (title.trim().length < 3) return setError(tc("unknownError"));
    const base = {
      title: title.trim(),
      level: level.trim() || undefined,
      durationMinutes: duration ? Number(duration) : undefined,
      isDemo,
    };
    const handlers = {
      onSuccess: () => {
        toast.success(isEdit ? tc("saved") : t("created"));
        onClose();
      },
      onError: (e: unknown) => setError(e instanceof ApiError ? e.message : tc("unknownError")),
    };
    if (isEdit) update.mutate({ ...base, isActive }, handlers);
    else create.mutate({ ...base, type }, handlers);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? tc("edit") : t("create")}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {error && (
            <div className="rounded-[8px] border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}

          {!isEdit && (
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((ty) => (
                <button
                  key={ty}
                  type="button"
                  onClick={() => setType(ty)}
                  aria-pressed={type === ty}
                  className={cn(
                    "rounded-[8px] border px-3 py-2 text-sm font-medium uppercase transition-colors",
                    type === ty
                      ? "border-brand bg-brand-subtle text-brand-subtle-fg"
                      : "border-border bg-surface text-fg-muted hover:bg-surface-hover",
                  )}
                >
                  {ty}
                </button>
              ))}
            </div>
          )}

          <Field label={tc("name")} htmlFor="ttitle">
            <Input id="ttitle" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("level")} htmlFor="tlevel">
              <Input id="tlevel" value={level} onChange={(e) => setLevel(e.target.value)} placeholder="B2" />
            </Field>
            <Field label={t("duration")} htmlFor="tdur">
              <Input id="tdur" type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} />
            </Field>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsDemo((v) => !v)}
              aria-pressed={isDemo}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                isDemo ? "border-info bg-info-bg text-info" : "border-border text-fg-muted hover:bg-surface-hover",
              )}
            >
              {t("isDemo")}
            </button>
            {isEdit && (
              <button
                type="button"
                onClick={() => setIsActive((v) => !v)}
                aria-pressed={isActive}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive ? "border-success bg-success-bg text-success" : "border-border text-fg-muted hover:bg-surface-hover",
                )}
              >
                {t("isActive")}
              </button>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button onClick={submit} loading={pending}>
            {tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
