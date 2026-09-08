// frontend/src/components/exam-builder/visual-editor/__tests__/excerpt.spec.ts
import { describe, expect, it } from "vitest";
import { excerptFor } from "../QuestionSettingsDrawer";

describe("excerptFor", () => {
  it("node mid-text returns radius chars on both sides", () => {
    const left = "0123456789".repeat(10);
    const right = "abcdefghijklmnopqrstuvwxyz".repeat(4);
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: left },
            { type: "questionNode", attrs: { clientId: "c1" } },
            { type: "text", text: right },
          ],
        },
      ],
    };
    expect(excerptFor(doc, "c1")).toBe(
      "0123456789012345678901234567890123456789abcdefghijklmnopqrstuvwxyzabcdefghijklmn",
    );
  });

  it("node at start returns right side only", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "questionNode", attrs: { clientId: "c1" } },
            { type: "text", text: "abcdefghijklmnopqrstuvwxyz" },
          ],
        },
      ],
    };
    expect(excerptFor(doc, "c1", 10)).toBe("abcdefghij");
  });

  it("missing id returns empty string", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }],
    };
    expect(excerptFor(doc, "nope")).toBe("");
  });

  it("unknown or missing shapes return empty string", () => {
    expect(excerptFor(null, "c1")).toBe("");
    expect(excerptFor(undefined, "c1")).toBe("");
    expect(excerptFor({}, "c1")).toBe("");
    expect(excerptFor({ content: "nope" }, "c1")).toBe("");
  });
});
