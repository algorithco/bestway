"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, ClipboardPaste, Eye, FileText, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { useImportQuestions, usePreviewQuestionImport } from "@/hooks/use-tests";
import { ApiError } from "@/lib/api-client";
import type { TestImportPreview, TestSection } from "@/lib/types";

const SECTIONS: TestSection[] = ["listening", "reading", "writing", "speaking"];
const EXAMPLE = `[READING]
Instructions: Choose the correct answer.
Passage: Solar power is becoming more common around the world.

1. What is becoming more common?
A) Wind power
B) Solar power
C) Coal

2. Complete the sentence: Solar power is becoming more ___.

[WRITING]
3. Discuss the advantages of renewable energy.
Score: 9

ANSWER KEY
1: B
2: common`;

function message(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : error instanceof Error ? error.message : fallback;
}

export function BulkQuestionImportDialog({
  open,
  onClose,
  testId,
}: {
  open: boolean;
  onClose: () => void;
  testId: string;
}) {
  const t = useTranslations("tests");
  const tc = useTranslations("common");
  const previewMutation = usePreviewQuestionImport();
  const importMutation = useImportQuestions(testId);
  const [text, setText] = React.useState("");
  const [defaultSection, setDefaultSection] = React.useState<TestSection | "">("");
  const [preview, setPreview] = React.useState<TestImportPreview | null>(null);
  const [snapshot, setSnapshot] = React.useState("");

  const payload = React.useMemo(
    () => ({ text, ...(defaultSection ? { defaultSection } : {}) }),
    [text, defaultSection],
  );
  const signature = `${defaultSection}\n${text}`;
  const stale = preview != null && snapshot !== signature;
  const valid = !!preview && !stale && preview.questions.length > 0 && preview.errors.length === 0;

  async function check() {
    if (!text.trim()) return;
    try {
      const result = await previewMutation.mutateAsync(payload);
      setPreview(result);
      setSnapshot(signature);
    } catch (error) {
      toast.error(message(error, tc("unknownError")));
    }
  }

  async function importAll() {
    if (!valid) return;
    try {
      const result = await importMutation.mutateAsync(payload);
      toast.success(t("bulkImportSuccess", { count: result.added }));
      setText("");
      setPreview(null);
      setSnapshot("");
      onClose();
    } catch (error) {
      toast.error(message(error, tc("unknownError")));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="flex max-h-[92dvh] max-w-5xl flex-col overflow-hidden" hideClose>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="size-5 text-brand" />
            {t("bulkImportTitle")}
          </DialogTitle>
          <DialogDescription>{t("bulkImportDescription")}</DialogDescription>
        </DialogHeader>

        <DialogBody className="grid min-h-0 flex-1 gap-4 overflow-y-auto lg:grid-cols-[1.05fr_.95fr]">
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-semibold text-fg" htmlFor="bulk-default-section">
                {t("bulkDefaultSection")}
              </label>
              <select
                id="bulk-default-section"
                value={defaultSection}
                onChange={(event) => setDefaultSection(event.target.value as TestSection | "")}
                className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-fg"
              >
                <option value="">{t("bulkSectionsInText")}</option>
                {SECTIONS.map((section) => <option key={section} value={section}>{t(`sections.${section}`)}</option>)}
              </select>
            </div>
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="min-h-[360px] resize-y font-mono text-[13px] leading-relaxed"
              placeholder={t("bulkPastePlaceholder")}
              autoFocus
            />
            <div className="rounded-lg border border-border bg-bg-subtle p-3 text-xs leading-relaxed text-fg-muted">
              <p className="font-semibold text-fg">{t("bulkFormatTitle")}</p>
              <p className="mt-1">{t("bulkFormatHint")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setText(EXAMPLE)}>
                  <FileText className="size-4" /> {t("bulkUseExample")}
                </Button>
              </div>
            </div>
          </section>

          <section className="min-h-[360px] rounded-xl border border-border bg-bg-subtle/50 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
                <Eye className="size-4" /> {t("bulkPreview")}
              </h3>
              {preview && !stale && (
                <Badge variant={preview.errors.length ? "danger" : "success"}>
                  {preview.questions.length} {t("questions")}
                </Badge>
              )}
            </div>

            {!preview ? (
              <div className="grid min-h-72 place-items-center text-center text-sm text-fg-muted">
                <div><Sparkles className="mx-auto mb-2 size-7 text-brand" /><p>{t("bulkPreviewEmpty")}</p></div>
              </div>
            ) : stale ? (
              <div className="grid min-h-72 place-items-center text-center text-sm text-warning">
                <p>{t("bulkPreviewStale")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(preview.errors.length > 0 || preview.warnings.length > 0) && (
                  <div className="space-y-2">
                    {preview.errors.map((issue, index) => (
                      <div key={`e-${index}`} className="flex gap-2 rounded-lg border border-danger-border bg-danger-bg p-2 text-xs text-danger">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                        <span>{issue.line ? `${t("bulkLine")} ${issue.line}: ` : ""}{issue.message}</span>
                      </div>
                    ))}
                    {preview.warnings.map((issue, index) => (
                      <div key={`w-${index}`} className="flex gap-2 rounded-lg border border-warning/30 bg-warning/10 p-2 text-xs text-warning">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                        <span>{issue.line ? `${t("bulkLine")} ${issue.line}: ` : ""}{issue.message}</span>
                      </div>
                    ))}
                  </div>
                )}
                {preview.errors.length === 0 && (
                  <div className="flex gap-2 rounded-lg border border-success/25 bg-success-bg p-2 text-xs text-success">
                    <CheckCircle2 className="size-4 shrink-0" /> {t("bulkReady")}
                  </div>
                )}
                <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
                  {preview.questions.map((question) => (
                    <div key={`${question.section}-${question.number}`} className="rounded-lg border border-border bg-surface p-3">
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge variant="neutral">#{question.number}</Badge>
                        <Badge variant="info">{t(`sections.${question.section}`)}</Badge>
                        <span className="text-[11px] text-fg-subtle">{t(`types.${question.type}`)} · {question.maxScore} pt</span>
                      </div>
                      <p className="text-sm text-fg">{question.prompt}</p>
                      {question.options?.length ? <p className="mt-1 text-xs text-fg-muted">{question.options.join(" · ")}</p> : null}
                      {question.correctAnswer ? <p className="mt-1 text-xs font-medium text-success">✓ {question.correctAnswer}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </DialogBody>

        <DialogFooter className="border-t border-border pt-3">
          <Button variant="outline" onClick={onClose}>{tc("cancel")}</Button>
          <Button variant="outline" onClick={check} disabled={!text.trim()} loading={previewMutation.isPending}>
            <Eye className="size-4" /> {preview ? t("bulkCheckAgain") : t("bulkCheck")}
          </Button>
          <Button onClick={importAll} disabled={!valid} loading={importMutation.isPending}>
            <ClipboardPaste className="size-4" /> {t("bulkImportAll")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
