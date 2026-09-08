import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { QuestionChip } from "./QuestionChip";

export const QuestionNode = Node.create({
  name: "questionNode",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      clientId: { default: "" },
      questionType: { default: "multiple_choice" },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-question-node][data-client-id]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-question-node": "", "data-client-id": HTMLAttributes.clientId })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(QuestionChip);
  },
});
