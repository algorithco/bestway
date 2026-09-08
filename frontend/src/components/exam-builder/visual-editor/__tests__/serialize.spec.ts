// frontend/src/components/exam-builder/visual-editor/__tests__/serialize.spec.ts
import { describe, expect, it } from "vitest";
import { serializeVisualDocument } from "../serialize";
import type { BuilderQuestion } from "@/components/mock/exam-builder/types";

function q(over: Partial<BuilderQuestion> & { clientId: string }): BuilderQuestion {
  return {
    number: 0,
    type: "multiple_choice",
    prompt: "p",
    options: ["a", "b"],
    correctAnswers: ["a"],
    acceptedVariants: [],
    points: 1,
    ...over,
  };
}

describe("serializeVisualDocument", () => {
  it("text-only document yields prose and zero questions", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
        { type: "paragraph", content: [{ type: "text", text: "World" }] },
      ],
    };
    const out = serializeVisualDocument(doc, {});
    expect(out.passageText).toBe("Hello\nWorld");
    expect(out.questions).toEqual([]);
  });

  it("single node with surrounding text numbers from base+1", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Read " },
            { type: "questionNode", attrs: { clientId: "c1", questionType: "multiple_choice" } },
            { type: "text", text: " then answer." },
          ],
        },
      ],
    };
    const out = serializeVisualDocument(doc, { c1: q({ clientId: "c1" }) }, 10);
    expect(out.passageText).toBe("Read  then answer.");
    expect(out.questions.map((x) => x.number)).toEqual([11]);
    expect(out.questions[0].clientId).toBe("c1");
  });

  it("multiple nodes keep doc order and contiguous numbers", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "questionNode", attrs: { clientId: "a", questionType: "short_answer" } },
            { type: "text", text: " mid " },
            { type: "questionNode", attrs: { clientId: "b", questionType: "short_answer" } },
          ],
        },
        {
          type: "paragraph",
          content: [{ type: "questionNode", attrs: { clientId: "c", questionType: "short_answer" } }],
        },
      ],
    };
    const out = serializeVisualDocument(
      doc,
      { a: q({ clientId: "a" }), b: q({ clientId: "b" }), c: q({ clientId: "c" }) },
      0,
    );
    expect(out.questions.map((x) => x.clientId)).toEqual(["a", "b", "c"]);
    expect(out.questions.map((x) => x.number)).toEqual([1, 2, 3]);
  });

  it("bare node with no surrounding text still serializes", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "questionNode", attrs: { clientId: "z", questionType: "essay_task2" } }] }],
    };
    const out = serializeVisualDocument(doc, { z: q({ clientId: "z", type: "essay_task2" }) }, 5);
    expect(out.passageText).toBe("");
    expect(out.questions[0].number).toBe(6);
  });

  it("drops map entries with no node and nodes with no map entry", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "questionNode", attrs: { clientId: "keep", questionType: "short_answer" } }] }],
    };
    const out = serializeVisualDocument(
      doc,
      { keep: q({ clientId: "keep" }), orphan: q({ clientId: "orphan" }) },
      0,
    );
    expect(out.questions.map((x) => x.clientId)).toEqual(["keep"]);
  });
});
