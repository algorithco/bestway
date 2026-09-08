// frontend/src/components/exam-builder/visual-editor/__tests__/visual-scratch.spec.ts
import { describe, expect, it } from "vitest";
import { visualScratchKey } from "../VisualQuestionCanvas";

describe("visualScratchKey", () => {
  it("builds a per-group namespaced key", () => {
    expect(visualScratchKey("g1")).toBe("examBuilder.visualScratch.g1");
  });

  it("never collides across groups", () => {
    expect(visualScratchKey("a")).not.toBe(visualScratchKey("b"));
  });
});
