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
      <DialogContent className="ml-auto h-full max-w-xl overflow-y-auto">
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
