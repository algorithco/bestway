"use client";
import * as React from "react";
import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Dropcursor from "@tiptap/extension-dropcursor";
import { QuestionNode } from "./question-node-extension";
import { serializeVisualDocument } from "./serialize";
import type { BuilderQuestion } from "@/components/mock/exam-builder/types";
import { validateOneQuestion } from "@/components/mock/exam-builder/types";
import type { MockSkill } from "@/lib/types";

type VisualStorage = {
  visual?: {
    getNumber: (id: string) => number;
    isIncomplete: (id: string) => boolean;
    openDrawer: (id: string) => void;
    deleteNode: (id: string) => void;
  };
};

function sanitizePastedHTML(html: string): string {
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n");
  const stripped = withBreaks.replace(/<[^>]*>/g, "");
  const decoded = stripped
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"');
  const escape = (s: string): string =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return decoded
    .split("\n")
    .map((line) => `<p>${escape(line)}</p>`)
    .join("");
}

export function VisualQuestionCanvas(props: {
  skill: MockSkill;
  initialText: string;
  initialQuestions: BuilderQuestion[];
  baseNumber: number;
  onChange: (text: string, questions: BuilderQuestion[]) => void;
}) {
  const [map, setMap] = React.useState<Record<string, BuilderQuestion>>(() =>
    Object.fromEntries(props.initialQuestions.map((q) => [q.clientId, q])),
  );
  const [order, setOrder] = React.useState<string[]>(
    props.initialQuestions.map((q) => q.clientId),
  );
  // Drawer UI mounts in Task 7; for now store the id and render nothing.
  const [openId, setOpenId] = React.useState<string | null>(null);
  void openId;

  // Ledger ruling: mapRef BEFORE useEditor (plan snippet order bug).
  const mapRef = React.useRef(map);
  mapRef.current = map;
  const orderRef = React.useRef(order);
  orderRef.current = order;
  const baseNumberRef = React.useRef(props.baseNumber);
  baseNumberRef.current = props.baseNumber;
  const skillRef = React.useRef(props.skill);
  skillRef.current = props.skill;
  const onChangeRef = React.useRef(props.onChange);
  onChangeRef.current = props.onChange;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
      }),
      Placeholder.configure({
        placeholder:
          "Paste question text here, then use the toolbar to add answer inputs where they belong.",
      }),
      Dropcursor.configure({ color: "var(--brand, #2563eb)", width: 2 }),
      QuestionNode,
    ],
    content: props.initialText
      ? {
          type: "doc",
          content: props.initialText
            .split("\n")
            .map((line) => ({
              type: "paragraph",
              content: line ? [{ type: "text", text: line }] : [],
            })),
        }
      : undefined,
    editorProps: {
      attributes: {
        class: "min-h-64 p-4 text-sm leading-relaxed focus:outline-none",
        "aria-label": "Visual question canvas",
      },
      transformPastedHTML(html) {
        return sanitizePastedHTML(html);
      },
      handlePaste(_view, event) {
        // Drop images/files from paste — media stays on dedicated upload flow.
        // transformPastedHTML strips <img> tags so pasted images can't render
        // (StarterKit image not installed); files have nothing to render into.
        if (event.clipboardData?.files?.length) {
          // Read to mark intentional; fall through so text still pastes sanitized.
          void event.clipboardData.files;
        }
        return false;
      },
    },
    onUpdate({ editor: updated }) {
      const doc = updated.getJSON() as JSONContent;
      const ids: string[] = [];
      for (const b of doc.content ?? [])
        for (const n of (b as { content?: Array<{ type?: string; attrs?: { clientId?: string } }> })
          .content ?? []) {
          if (n?.type === "questionNode" && typeof n?.attrs?.clientId === "string")
            ids.push(n.attrs.clientId);
        }
      setOrder(ids);
      const { passageText, questions } = serializeVisualDocument(
        doc,
        mapRef.current,
        baseNumberRef.current,
      );
      onChangeRef.current(passageText, questions);
    },
  });

  // Storage wiring for QuestionChip (Task 6 toolbar reuses same contract).
  React.useEffect(() => {
    if (!editor) return;
    (editor.storage as VisualStorage).visual = {
      getNumber: (id: string) =>
        orderRef.current.indexOf(id) + baseNumberRef.current + 1,
      isIncomplete: (id: string) => {
        const q = mapRef.current[id];
        if (!q) return true;
        return validateOneQuestion(skillRef.current, q).length > 0;
      },
      openDrawer: (id: string) => {
        setOpenId(id);
      },
      deleteNode: (id: string) => {
        let targetPos: number | null = null;
        let targetSize = 0;
        editor.state.doc.descendants((node, pos) => {
          if (targetPos !== null) return false;
          if (node.type.name === "questionNode" && node.attrs.clientId === id) {
            targetPos = pos;
            targetSize = node.nodeSize;
            return false;
          }
          return undefined;
        });
        if (targetPos !== null) {
          const tr = editor.state.tr.delete(targetPos, targetPos + targetSize);
          editor.view.dispatch(tr);
        }
        setMap((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setOpenId((prev) => (prev === id ? null : prev));
      },
    };
  });

  // GC effect: 500ms debounce removing map keys absent from order.
  React.useEffect(() => {
    const t = setTimeout(() => {
      setMap((prev) => {
        const alive = new Set(orderRef.current);
        let changed = false;
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          if (!alive.has(k)) {
            delete next[k];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 500);
    return () => clearTimeout(t);
  }, [order]);

  return (
    <div className="rounded border border-border bg-surface">
      <EditorContent editor={editor} />
    </div>
  );
}
