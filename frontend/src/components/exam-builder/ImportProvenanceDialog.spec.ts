import { describe, expect, it } from "vitest";
import { issueSelection } from "./ImportProvenanceDialog";
import type { MockExamDetail, MockExamImportProvenance } from "@/lib/types";

const detail = {
  sections: [
    {
      id: "sec-1",
      groups: [{ id: "grp-1", questions: [{ id: "q-1" }, { id: "q-2" }] }],
    },
  ],
} as unknown as MockExamDetail;

const provenance = {
  sourceMaps: [
    { kind: "section", sourceKey: "reading", entityId: "sec-1" },
    { kind: "group", sourceKey: "g1", entityId: "grp-1" },
    { kind: "question", sourceKey: "q1", entityId: "q-1" },
  ],
} as MockExamImportProvenance;

describe("issueSelection", () => {
  it("maps section/group/question sources to editor selections", () => {
    expect(
      issueSelection(detail, provenance, { sourceKey: "reading", entityKind: "section" }),
    ).toEqual({ kind: "section", sectionId: "sec-1" });
    expect(issueSelection(detail, provenance, { sourceKey: "g1", entityKind: "group" })).toEqual({
      kind: "group",
      groupId: "grp-1",
    });
    expect(
      issueSelection(detail, provenance, { sourceKey: "q1", entityKind: "question" }),
    ).toEqual({ kind: "group", groupId: "grp-1" });
  });

  it("returns null when the source cannot be located", () => {
    expect(issueSelection(detail, provenance, { sourceKey: null, entityKind: null })).toBeNull();
    expect(
      issueSelection(detail, provenance, { sourceKey: "missing", entityKind: "group" }),
    ).toBeNull();
  });
});
