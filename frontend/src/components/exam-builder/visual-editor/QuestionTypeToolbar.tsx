"use client";
import { GROUPED_TYPES, QTYPE_LABEL } from "@/components/mock/exam-builder/types";
import { TYPES_BY_SKILL } from "@/components/exam-builder/types";
import type { MockQuestionType, MockSkill } from "@/lib/types";

const SHORT: Partial<Record<MockQuestionType, string>> = {
  multiple_choice: "MCQ",
  multi_select: "Multi",
  true_false_notgiven: "T/F/NG",
  yes_no_notgiven: "Y/N/NG",
};

export function QuestionTypeToolbar({ skill, onInsert }: { skill: MockSkill; onInsert: (t: MockQuestionType) => void }) {
  const allowed = new Set(TYPES_BY_SKILL[skill]);
  return (
    <div className="sticky top-36 z-[5] flex flex-wrap gap-x-4 gap-y-2 bg-bg/95 py-2 backdrop-blur" role="toolbar" aria-label="Add question">
      {GROUPED_TYPES.map((g) => {
        const types = g.types.filter((t) => allowed.has(t));
        if (!types.length) return null;
        return (
          <div key={g.group} className="flex items-center gap-1">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">{g.group}</span>
            {types.map((t) => (
              <button key={t} type="button" title={QTYPE_LABEL[t]} onClick={() => onInsert(t)} className="rounded border border-border px-2 py-1 text-xs hover:bg-bg-subtle">
                {SHORT[t] ?? QTYPE_LABEL[t]}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
