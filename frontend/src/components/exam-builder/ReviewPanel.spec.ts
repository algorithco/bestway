import { describe, expect, it } from "vitest";
import { reviewBlockerCount, type ReadinessBlocker } from "./review-blockers";

const items: ReadinessBlocker[] = [
  { key: "answer_keys", ok: false, detail: "1 auto Q without key" },
  { key: "import_issues", ok: false, detail: "5 open import issues" },
  { key: "reading_passage", ok: true, detail: "all passages have text" },
];

describe("reviewBlockerCount", () => {
  it("expands the aggregate import blocker to the exact provenance count", () => {
    expect(reviewBlockerCount(0, items, 5)).toBe(6);
  });

  it("uses one safe fallback while provenance is unavailable", () => {
    expect(reviewBlockerCount(0, items, null)).toBe(2);
  });

  it("includes client and readiness-request errors", () => {
    expect(reviewBlockerCount(2, [], 0, true)).toBe(3);
  });
});
