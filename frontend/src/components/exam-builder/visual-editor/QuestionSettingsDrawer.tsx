"use client";
import type { JSX } from "react";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QuestionFieldSet } from "@/components/mock/exam-builder/QuestionEditor";
import type { BuilderQuestion } from "@/components/mock/exam-builder/types";
import type { MockQuestionType, MockSkill } from "@/lib/types";

/* ── excerptFor (pure) ───────────────────────────────────────────────
 * Walk doc.content[].content[] in order, concatenating text runs and
 * recording the char index of the questionNode whose attrs.clientId
 * matches. Return up to `radius` chars on each side (newlines collapsed
 * to spaces, trimmed). Unknown/missing shapes → "".
 */
export function excerptFor(doc: unknown, clientId: string, radius = 40): string {
  if (!doc || typeof doc !== "object") return "";
  const root = doc as { content?: unknown };
  if (!Array.isArray(root.content)) return "";
  let full = "";
  let pos: number | null = null;
  root.content.forEach((block: unknown, blockIndex: number) => {
    if (blockIndex > 0) full += "\n";
    if (!block || typeof block !== "object") return;
    const inner = (block as { content?: unknown }).content;
    if (!Array.isArray(inner)) return;
    for (const item of inner) {
      if (!item || typeof item !== "object") continue;
      const node = item as { type?: unknown; text?: unknown; attrs?: unknown };
      if (node.type === "questionNode") {
        if (pos === null && node.attrs && typeof node.attrs === "object") {
          const attrs = node.attrs as { clientId?: unknown };
          if (attrs.clientId === clientId) pos = full.length;
        }
        continue;
      }
      if (node.type === "text" && typeof node.text === "string") full += node.text;
    }
  });
  if (pos === null) return "";
  const start = Math.max(0, pos - radius);
  const end = Math.min(full.length, pos + radius);
  return full.slice(start, end).replace(/\n/g, " ").trim();
}

export function QuestionSettingsDrawer(props: {
  open: boolean;
  onClose: () => void;
  question: BuilderQuestion | null;
  skill: MockSkill;
  allowedTypes: MockQuestionType[];
  excerpt: string;
  onChange: (q: BuilderQuestion) => void;
}): JSX.Element | null {
  const { open, onClose, question, skill, allowedTypes, excerpt, onChange } = props;
  if (question == null) return null;
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      {/* Right-dock overrides: base DialogContent centers via left-1/2/top-1/2 +
          translate; tailwind-merge (cn) keeps the LAST conflicting utility, so
          left-auto/top-0/right-0/translate-0/h-dvh win. NOTE: `max-h-none`
          does NOT merge away the base `max-h-[min(92dvh,720px)]` (named vs
          arbitrary are separate twMerge groups — both survive, cascade wins),
          so the cap is overridden with the same-kind arbitrary
          `max-h-[100dvh]` (verified: only it survives). max-w-full wins over
          base max-w-lg while sm:max-w-xl restores the desktop cap (360px safe
          via full-bleed sheet; base w-calc overridden by w-full). */}
      <DialogContent className="ml-auto h-full max-w-full overflow-y-auto sm:max-w-xl left-auto right-0 top-0 max-h-[100dvh] h-dvh w-full translate-x-0 translate-y-0 rounded-l-2xl rounded-r-none max-sm:max-h-[100dvh]">
        <DialogHeader>
          <DialogTitle>Question settings</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {excerpt ? (
            <p className="rounded bg-bg-subtle p-2 text-xs text-fg-muted">…{excerpt}…</p>
          ) : null}
          <QuestionFieldSet
            question={question}
            skill={skill}
            allowedTypes={allowedTypes}
            onChange={onChange}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
