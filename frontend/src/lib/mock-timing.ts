import type { MockSkill } from "./types";

/**
 * Display-only exam total ("X min") — frontend mirror of backend
 * `mock-shape.ts` `totalDuration()` / `computeSkillTiming()`.
 *
 * - listening: `ceil((audio sum || 30min fallback + 120s review) / 60)` —
 *   the stored listening `durationMinutes` is NEVER used for timing, so it
 *   must not contribute to the displayed total either.
 * - speaking: untimed → contributes 0.
 * - reading/writing: stored `durationMinutes`, else the 60min timer default.
 *
 * Keep in sync with `backend/src/mock/mock-shape.ts`. Exam cards that only
 * have the backend-computed `durationMinutes` should render that value
 * directly; this helper is for views holding full `sections` client-side.
 */
export const LISTENING_REVIEW_SEC = 120;
export const FALLBACK_LISTENING_SEC = 30 * 60;
export const DEFAULT_SECTION_MIN = 60;

export interface TimingSectionInput {
  skill: MockSkill;
  durationMinutes?: number | null;
  groups?: Array<{ audioDurationSec?: number | null }>;
}

export function displayTotalMinutes(sections: TimingSectionInput[]): number | null {
  let sum = 0;
  for (const sec of sections) {
    if (sec.skill === "listening") {
      const audioSec = (sec.groups ?? []).reduce((s, g) => s + (g.audioDurationSec ?? 0), 0);
      sum += Math.ceil(
        ((audioSec > 0 ? audioSec : FALLBACK_LISTENING_SEC) + LISTENING_REVIEW_SEC) / 60,
      );
    } else if (sec.skill === "speaking") {
      continue;
    } else {
      sum += sec.durationMinutes ?? DEFAULT_SECTION_MIN;
    }
  }
  return sum > 0 ? sum : null;
}
