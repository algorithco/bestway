import { describe, expect, it } from "vitest";
import {
  EXAM_IMPORT_TEMPLATES,
  createExamImportTemplate,
} from "../../../frontend/src/components/exam-builder/import-templates";
import { validateImportPackage } from "./mock-import-validate";

describe("frontend IELTS Reading and Listening import templates", () => {
  it.each(EXAM_IMPORT_TEMPLATES)("$id passes backend import validation", ({ id }) => {
    const pkg = createExamImportTemplate(id, new Date("2026-10-01T08:00:00.000Z"));
    const report = validateImportPackage(pkg);

    expect(report.issues.filter((issue) => issue.blocks.includes("import"))).toEqual([]);
    expect(report.canImport).toBe(true);
    // Generated placeholders are safe to import as a draft, never to publish.
    expect(report.canPublish).toBe(false);
    expect(report.issues.some((issue) => issue.code === "REVIEW_OPEN")).toBe(true);
  });

  it("validates the full Reading template as three passages and 40 questions", () => {
    const pkg = createExamImportTemplate(
      "academic-reading-full",
      new Date("2026-10-01T08:00:00.000Z"),
    );
    const report = validateImportPackage(pkg);

    expect(report.counts.sections).toBe(1);
    expect(report.counts.skills).toBe(1);
    expect(report.counts.questions).toBe(40);
    expect(report.counts.groups).toBeGreaterThanOrEqual(3);
  });

  it("validates the full Listening template as four parts and 40 questions", () => {
    const pkg = createExamImportTemplate(
      "listening-full",
      new Date("2026-10-01T08:00:00.000Z"),
    ) as {
      exam: { sections: Array<{ groups: Array<{ partNumber?: number; audioRef?: string }> }> };
      media: unknown[];
    };
    const report = validateImportPackage(pkg);
    const groups = pkg.exam.sections[0].groups;

    expect(report.counts.sections).toBe(1);
    expect(report.counts.skills).toBe(1);
    expect(report.counts.groups).toBe(4);
    expect(report.counts.questions).toBe(40);
    expect(groups.map((group) => group.partNumber)).toEqual([1, 2, 3, 4]);
    expect(groups.every((group) => group.audioRef === undefined)).toBe(true);
    expect(pkg.media).toEqual([]);
  });
});
