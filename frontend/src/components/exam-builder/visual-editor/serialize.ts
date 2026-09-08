// frontend/src/components/exam-builder/visual-editor/serialize.ts
import type { JSONContent } from "@tiptap/react";
import type { BuilderQuestion } from "@/components/mock/exam-builder/types";

type TextInline = { type?: string; text?: string; attrs?: { clientId?: string } };

export function serializeVisualDocument(
  doc: JSONContent,
  map: Record<string, BuilderQuestion>,
  baseNumber = 0,
): { passageText: string; questions: BuilderQuestion[] } {
  const paragraphs: string[] = [];
  const orderedIds: string[] = [];
  const blocks = Array.isArray(doc?.content) ? doc.content : [];
  for (const block of blocks) {
    let line = "";
    const inlines = Array.isArray((block as JSONContent)?.content)
      ? ((block as JSONContent).content as TextInline[])
      : [];
    for (const inline of inlines) {
      if (inline?.type === "questionNode") {
        const id = inline?.attrs?.clientId;
        if (typeof id === "string" && map[id] && !orderedIds.includes(id)) orderedIds.push(id);
        continue;
      }
      if (typeof inline?.text === "string") line += inline.text;
    }
    paragraphs.push(line);
  }
  // Strip leading/trailing empty paragraphs but keep inner breaks (matches whitespace-pre-line render).
  while (paragraphs.length > 0 && paragraphs[0].trim() === "") paragraphs.shift();
  while (paragraphs.length > 0 && paragraphs[paragraphs.length - 1].trim() === "") paragraphs.pop();
  const questions = orderedIds.map((id, idx) => ({ ...map[id], number: baseNumber + idx + 1 }));
  return { passageText: paragraphs.join("\n"), questions };
}
