"use client";

import { useTranslations } from "next-intl";
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
import { useMockPreview } from "@/hooks/use-mock";
import type { MockSkill } from "@/lib/types";
import { StudentPreview, type PreviewGroup } from "./StudentPreview";
import { tx } from "./types";

interface PreviewSection {
  id: string;
  skill: MockSkill;
  title?: string | null;
  instructions?: string | null;
  groups?: Array<{
    id: string;
    title?: string | null;
    instructions?: string | null;
    passageText?: string | null;
    hasAudio?: boolean;
    imageUrl?: string | null;
    questions?: Array<{
      id: string;
      number: number;
      type: string;
      prompt: string;
      options?: string[] | null;
      points?: number;
      wordLimit?: number | null;
    }>;
  }>;
}

/** Whole-exam student preview (sanitized, no keys) — no publish needed to look.
 *  Closing returns to the exact builder location (selection state is untouched). */
export function PreviewDialog({ examId, onClose }: { examId: string; onClose: () => void }) {
  const t = useTranslations("examBuilder");
  const tc = useTranslations("common");
  const q = useMockPreview(examId, true);
  const data = q.data as unknown as { title?: string; sections?: PreviewSection[] } | undefined;
  const sections = data?.sections ?? [];
  const questionCount = sections.reduce((n, s) => n + (s.groups ?? []).reduce((a, g) => a + (g.questions ?? []).length, 0), 0);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-2 shrink-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">
            {tx(t, "studentView", "Student view")}
          </p>
          <DialogTitle>
            {data?.title ?? tx(t, "preview", "Preview")}
          </DialogTitle>
          {!q.isLoading && !q.isError && sections.length > 0 && (
            <p className="text-xs text-fg-muted">
              {sections.length} {tx(t, "sections", "sections")} · {questionCount}{" "}
              {tx(t, "questions", "questions")}
            </p>
          )}
        </DialogHeader>
        <DialogBody className="px-5 pb-3 overflow-y-auto space-y-6">
          {q.isLoading && (
            <div className="space-y-2" role="status" aria-label={tx(t, "loadingPreview", "Loading preview")}>
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          )}
          {q.isError && (
            <ErrorState
              title={tx(t, "previewFailed", "Preview failed to load.")}
              action={
                <Button variant="outline" size="sm" onClick={() => q.refetch()}>
                  {tc("retry")}
                </Button>
              }
            />
          )}
          {!q.isLoading && !q.isError && sections.length === 0 && (
            <p className="text-sm text-fg-muted">
              {tx(t, "previewEmpty", "Nothing to preview yet — add sections and questions first.")}
            </p>
          )}
          {sections.map((s) => (
            <section key={s.id} aria-label={s.title?.trim() || s.skill}>
              <h3 className="mb-1 text-sm font-bold capitalize text-fg">
                {s.title?.trim() || s.skill}
              </h3>
              {s.instructions?.trim() && (
                <p className="mb-2 text-sm text-fg-muted">{s.instructions}</p>
              )}
              <div className="space-y-3">
                {(s.groups ?? []).map((g) => {
                  const pg: PreviewGroup = {
                    id: g.id,
                    title: g.title ?? null,
                    instructions: g.instructions ?? null,
                    passageText: g.passageText ?? null,
                    hasAudio: !!g.hasAudio,
                    imageUrl: g.imageUrl ?? null,
                    questions: (g.questions ?? []).map((x) => ({
                      id: x.id,
                      number: x.number,
                      type: x.type,
                      prompt: x.prompt,
                      options: x.options ?? null,
                      points: x.points ?? 1,
                      wordLimit: x.wordLimit ?? null,
                    })),
                  };
                  return <StudentPreview key={g.id} group={pg} skill={s.skill} />;
                })}
              </div>
            </section>
          ))}
        </DialogBody>
        <DialogFooter className="px-5 pb-5 shrink-0">
          <Button variant="outline" onClick={onClose}>
            {tx(t, "backToEditing", "Back to editing")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
