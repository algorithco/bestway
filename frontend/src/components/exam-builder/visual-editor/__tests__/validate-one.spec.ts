import { describe, expect, it } from "vitest";
import { validateOneQuestion } from "@/components/mock/exam-builder/types";
import type { BuilderQuestion } from "@/components/mock/exam-builder/types";

const base: BuilderQuestion = { clientId: "c", number: 3, type: "multiple_choice", prompt: "Why?", options: ["a", "b"], correctAnswers: ["a"], acceptedVariants: [], points: 1 };

describe("validateOneQuestion", () => {
  it("flags empty prompt", () => {
    expect(validateOneQuestion("reading", { ...base, prompt: "  " }).join(" ")).toMatch(/prompt/i);
  });
  it("flags choice with <2 options", () => {
    expect(validateOneQuestion("reading", { ...base, type: "multiple_choice", options: ["only"] }).length).toBeGreaterThan(0);
  });
  it("flags auto type with no key", () => {
    expect(validateOneQuestion("reading", { ...base, type: "short_answer", correctAnswers: [] }).length).toBeGreaterThan(0);
  });
  it("passes valid manual essay", () => {
    expect(validateOneQuestion("writing", { ...base, type: "essay_task2", options: [], correctAnswers: [] })).toEqual([]);
  });
});
