import { describe, expect, it } from "vitest";
import { clusterReadingPassages } from "./reading-passage-clusters";

function group(id: string, passageText: string, numbers: number[]) {
  return {
    id,
    title: passageText,
    passageText,
    questions: numbers.map((number) => ({ number })),
  };
}

describe("clusterReadingPassages", () => {
  it("keeps ten task groups under three real passages", () => {
    const groups = [
      group("1a", "Bakelite", [1, 2, 3]),
      group("1b", "Bakelite", [4, 5, 6, 7, 8]),
      group("1c", "Bakelite", [9]),
      group("1d", "Bakelite", [11, 12, 13]),
      group("2a", "What's so funny?", [14, 15, 16, 17, 18, 19, 20]),
      group("2b", "What's so funny?", [21, 22, 23]),
      group("2c", "What's so funny?", [24, 25, 26, 27]),
      group("3a", "Scientific English", [28, 29, 30, 31, 32, 33, 34]),
      group("3b", "Scientific English", [35, 36, 37]),
      group("3c", "Scientific English", [38, 39, 40]),
    ];

    const passages = clusterReadingPassages(groups);

    expect(passages).toHaveLength(3);
    expect(passages.map((passage) => passage.groups.length)).toEqual([4, 3, 3]);
    expect(passages.map((passage) => passage.rangeLabel)).toEqual([
      "1–13",
      "14–27",
      "28–40",
    ]);
  });

  it("does not merge blank passages or non-consecutive repeated text", () => {
    const passages = clusterReadingPassages([
      group("empty-1", "", []),
      group("empty-2", "", []),
      group("a", "Passage A", [1]),
      group("b", "Passage B", [2]),
      group("a-again", "Passage A", [3]),
    ]);

    expect(passages).toHaveLength(5);
  });
});
