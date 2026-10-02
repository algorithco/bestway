import { describe, expect, it } from "vitest";
import { clusterDisplayPassages, gapNumbersIn, splitPreviewDocument } from "./reading-preview-model";
import type { PreviewGroup, PreviewQuestion } from "./StudentPreview";

function q(n: number, type = "true_false_notgiven"): PreviewQuestion {
  return { id: `q${n}`, number: n, type, prompt: `Statement ${n}`, options: null, points: 1, wordLimit: null };
}

function group(
  id: string,
  numbers: number[],
  opts?: Partial<PreviewGroup> & { type?: string },
): PreviewGroup {
  return {
    id,
    title: opts?.title ?? "Urban Beekeeping",
    instructions: opts?.instructions ?? "Do the following statements agree with the information?",
    passageText: opts?.passageText ?? "Bees live in cities.\n\nThey make honey.",
    contentHtml: opts?.contentHtml ?? null,
    hasAudio: false,
    imageUrl: null,
    questions: numbers.map((n) => q(n, opts?.type)),
  };
}

describe("clusterDisplayPassages", () => {
  it("keeps one passage with two task blocks when types change (Q1-13)", () => {
    const g = group("g1", [1, 2, 3, 4, 5, 6, 7]);
    g.questions.push(...[8, 9, 10, 11, 12, 13].map((n) => q(n, "summary_completion")));
    const [passage] = clusterDisplayPassages([g]);
    expect(passage.ordinal).toBe(1);
    expect(passage.rangeLabel).toBe("1–13");
    expect(passage.blocks).toHaveLength(2);
    expect(passage.blocks[0].heading).toBe("Questions 1–7");
    expect(passage.blocks[1].heading).toBe("Questions 8–13");
    expect(passage.questions.map((x) => x.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });

  it("merges two groups repeating the same passage into one passage", () => {
    const a = group("g1", [1, 2, 3, 4, 5, 6, 7]);
    const b = group("g2", [8, 9, 10, 11, 12, 13], {
      type: "summary_completion",
      instructions: "Complete the summary below.",
    });
    const passages = clusterDisplayPassages([a, b]);
    expect(passages).toHaveLength(1);
    expect(passages[0].rangeLabel).toBe("1–13");
    expect(passages[0].blocks.map((bl) => bl.heading)).toEqual(["Questions 1–7", "Questions 8–13"]);
    expect(passages[0].questions).toHaveLength(13);
  });

  it("never creates Passage 2 from a question-type change", () => {
    const a = group("g1", [1, 2], { passageText: "Same passage." });
    const b = group("g2", [3, 4], { passageText: "Same passage.", type: "matching_headings" });
    expect(clusterDisplayPassages([a, b])).toHaveLength(1);
  });

  it("keeps three genuinely separate passages separate", () => {
    const passages = clusterDisplayPassages([
      group("g1", [1, 2], { passageText: "First passage text." }),
      group("g2", [14, 15], { passageText: "Second passage text." }),
      group("g3", [27, 28], { passageText: "Third passage text." }),
    ]);
    expect(passages.map((p) => p.ordinal)).toEqual([1, 2, 3]);
    expect(passages.map((p) => p.rangeLabel)).toEqual(["1–2", "14–15", "27–28"]);
  });

  it("derives headings from real min/max numbers, never renumbers", () => {
    const g = group("g1", [5, 7, 6]);
    const [passage] = clusterDisplayPassages([g]);
    expect(passage.blocks[0].heading).toBe("Questions 5–7");
    expect(passage.questions.map((x) => x.number)).toEqual([5, 7, 6]);
  });

  it("routes a gapped note-completion group to a right-panel doc, not generic inputs", () => {
    const tfng = group("g1", [1, 2, 3, 4, 5, 6, 7]);
    const note = group("g2", [8, 9, 10, 11, 12, 13], {
      type: "note_completion",
      instructions: "Complete the notes below.",
      contentHtml:
        '<h4>Notes</h4><p>Bees live in <span data-gap="8"></span> and make <span data-gap="9"></span>. ' +
        'They fly <span data-gap="10"></span> km. Hives need <span data-gap="11"></span>, ' +
        '<span data-gap="12"></span> and <span data-gap="13"></span>.</p>',
    });
    const [passage] = clusterDisplayPassages([tfng, note]);
    // One passage, full passage text intact, all 13 questions under it.
    expect(passage.passageText).toContain("Bees live in cities.");
    expect(passage.questions).toHaveLength(13);
    expect(passage.rangeLabel).toBe("1–13");
    // Two task blocks: generic TFNG + note doc block with zero generic inputs.
    expect(passage.blocks.map((bl) => bl.heading)).toEqual(["Questions 1–7", "Questions 8–13"]);
    expect(passage.blocks[0].questions).toHaveLength(7);
    expect(passage.blocks[0].docs).toHaveLength(0);
    expect(passage.blocks[1].questions).toHaveLength(0);
    expect(passage.blocks[1].docs).toHaveLength(1);
    expect(passage.blocks[1].docs[0].groupId).toBe("g2");
    expect(passage.blocks[1].docs[0].questions.map((x) => x.number)).toEqual([8, 9, 10, 11, 12, 13]);
    // Every question appears exactly once across generic controls and docs.
    const rendered = [
      ...passage.blocks.flatMap((bl) => bl.questions.map((x) => x.id)),
      ...passage.blocks.flatMap((bl) => bl.docs.flatMap((d) => d.questions.map((x) => x.id))),
    ];
    expect([...rendered].sort()).toEqual(passage.questions.map((x) => x.id).sort());
    expect(new Set(rendered).size).toBe(13);
  });

  it("merges adjacent gapped groups with the same task into one block with two docs", () => {
    const a = group("g1", [1, 2], {
      type: "table_completion",
      instructions: "Complete the table.",
      contentHtml: '<p>Row <span data-gap="1"></span> <span data-gap="2"></span></p>',
    });
    const b = group("g2", [3, 4], {
      type: "table_completion",
      instructions: "Complete the table.",
      contentHtml: '<p>Row <span data-gap="3"></span> <span data-gap="4"></span></p>',
    });
    const [passage] = clusterDisplayPassages([a, b]);
    expect(passage.blocks).toHaveLength(1);
    expect(passage.blocks[0].heading).toBe("Questions 1–4");
    expect(passage.blocks[0].docs.map((d) => d.groupId)).toEqual(["g1", "g2"]);
  });

  it("separates gap-free rich markup into staticDocs, never into task blocks", () => {
    const g = group("g1", [1], {
      contentHtml: "<p>Formatted <strong>passage</strong> paragraph.</p>",
    });
    const [passage] = clusterDisplayPassages([g]);
    expect(passage.staticDocs).toHaveLength(1);
    expect(passage.staticDocs[0].staticHtml).toContain("Formatted");
    expect(passage.blocks).toHaveLength(1);
    expect(passage.blocks[0].docs).toHaveLength(0);
    expect(passage.blocks[0].questions).toHaveLength(1);
  });

  it("keeps a gap document with no question rows visible instead of dropping it", () => {
    const g = group("g1", [], {
      instructions: "Complete the notes.",
      contentHtml: '<p>Note <span data-gap="8"></span> and <span data-gap="9"></span></p>',
    });
    const [passage] = clusterDisplayPassages([g]);
    expect(passage.blocks).toHaveLength(1);
    expect(passage.blocks[0].heading).toBe("Questions 8–9");
    expect(passage.blocks[0].docs).toHaveLength(1);
  });
});

describe("splitPreviewDocument", () => {
  it("detects gaps and strips numbers from the static variant", () => {
    const split = splitPreviewDocument("<p>Hives need <span data-gap=\"8\"></span> daily.</p>");
    expect(split.hasGaps).toBe(true);
    expect(split.staticHtml).toContain("Hives need");
    expect(split.staticHtml).not.toContain("data-gap");
    expect(split.staticHtml).not.toContain(">8<");
  });

  it("returns static markup for gap-free documents", () => {
    const split = splitPreviewDocument("<p>Plain <strong>text</strong>.</p>");
    expect(split.hasGaps).toBe(false);
    expect(split.staticHtml).toContain("Plain");
  });

  it("returns null static markup for gaps-only documents and empty input", () => {
    expect(splitPreviewDocument('<p><span data-gap="1"></span></p>').staticHtml).toBeNull();
    expect(splitPreviewDocument(null)).toEqual({ hasGaps: false, staticHtml: null });
    expect(splitPreviewDocument("   ")).toEqual({ hasGaps: false, staticHtml: null });
  });
});

describe("gapNumbersIn", () => {
  it("reads gap numbers in document order", () => {
    expect(gapNumbersIn('<p><span data-gap="8"></span>x<span data-gap="10"></span></p>')).toEqual([8, 10]);
    expect(gapNumbersIn("<p>No gaps</p>")).toEqual([]);
  });
});
