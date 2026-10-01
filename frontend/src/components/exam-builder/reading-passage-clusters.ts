export interface ReadingClusterGroup {
  title?: string | null;
  passageText?: string | null;
  questions: Array<{ number: number }>;
}

export interface ReadingPassageCluster<T extends ReadingClusterGroup> {
  ordinal: number;
  title: string | null;
  passageText: string | null;
  groups: T[];
  questions: T["questions"];
  min: number | null;
  max: number | null;
  rangeLabel: string | null;
}

function normalizedPassageText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

/**
 * JSON imports keep each IELTS question set as a separate persisted group so
 * it can retain its own instructions and rich task document. Consecutive
 * groups that repeat the same source passage are nevertheless one Reading
 * passage and must be counted/presented as such throughout the builder.
 */
export function clusterReadingPassages<T extends ReadingClusterGroup>(
  groups: readonly T[],
): ReadingPassageCluster<T>[] {
  const members: T[][] = [];

  for (const group of groups) {
    const text = normalizedPassageText(group.passageText);
    const previous = members[members.length - 1];
    const previousText = previous
      ? normalizedPassageText(previous[0].passageText)
      : "";

    if (previous && text !== "" && text === previousText) {
      previous.push(group);
    } else {
      members.push([group]);
    }
  }

  return members.map((passageGroups, index) => {
    const questions = passageGroups.flatMap((group) => group.questions);
    const numbers = questions.map((question) => question.number);
    const min = numbers.length > 0 ? Math.min(...numbers) : null;
    const max = numbers.length > 0 ? Math.max(...numbers) : null;

    return {
      ordinal: index + 1,
      title:
        passageGroups
          .map((group) => group.title?.trim())
          .find((title): title is string => Boolean(title)) ?? null,
      passageText:
        passageGroups
          .map((group) => group.passageText)
          .find((text): text is string => Boolean(text?.trim())) ?? null,
      groups: passageGroups,
      questions,
      min,
      max,
      rangeLabel:
        min == null || max == null
          ? null
          : min === max
            ? `${min}`
            : `${min}–${max}`,
    };
  });
}
