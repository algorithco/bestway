import { describe, expect, it } from "vitest";
import {
  extractMediaDeclarations,
  findDuplicateKeys,
  groupImportIssues,
  parsePackageInput,
} from "./import-json";

describe("import-json helpers", () => {
  it("parses pasted JSON and rejects oversized input", () => {
    expect(parsePackageInput('{"a":1}').ok).toBe(true);
    const bad = parsePackageInput("{not json");
    expect(bad.ok).toBe(false);
    const big = parsePackageInput("x".repeat(2 * 1024 * 1024 + 1));
    expect(big.ok).toBe(false);
  });

  it("detects duplicate object keys before upload", () => {
    expect(findDuplicateKeys('{"a":1,"b":2}')).toEqual([]);
    expect(findDuplicateKeys('{"a":1,"a":2}').length).toBeGreaterThan(0);
  });

  it("extracts media declarations for the binding step", () => {
    const decls = extractMediaDeclarations({
      media: [{ key: "part-one", kind: "audio", fileName: "p1.mp3", requiredForPublish: true }],
    });
    expect(decls).toEqual([
      { key: "part-one", kind: "audio", fileName: "p1.mp3", requiredForPublish: true },
    ]);
    expect(extractMediaDeclarations({})).toEqual([]);
  });

  it("splits report issues into import vs publish blockers", () => {
    const grouped = groupImportIssues([
      { code: "NUMBER_COLLISION", path: "/a", message: "m", blocks: ["import"] },
      { code: "MISSING_MEDIA", path: "/b", message: "m", blocks: ["publish"] },
    ]);
    expect(grouped.importBlocking).toHaveLength(1);
    expect(grouped.publishBlocking).toHaveLength(1);
  });
});
