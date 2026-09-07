/**
 * IELTS skill-specific timing verification (no DB needed).
 * Run: npm run test:timing
 *
 * Covers:
 *  - single_skill Listening timed deadline comes from audio length (+120s review),
 *    NEVER from durationMinutes
 *  - single_skill Speaking timed has NO deadline (null/null)
 *  - single_skill Reading/Writing timed unchanged (durationMinutes or 60min default)
 *  - full_test chaining composability (sequential fromTs)
 */
import {
  SKILL_ORDER,
  computeSkillTiming,
} from '../src/mock/mock-shape';

let failures = 0;
function eq(actual: unknown, expected: unknown, label: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failures += 1;
    console.error(`FAIL ${label}: got ${a}, want ${e}`);
  } else {
    console.log(`ok ${label}`);
  }
}

const T0 = 1_700_000_000_000;

// 1. Listening: audio sum + 120s review, durationMinutes ignored.
{
  const groups = [{ audioDurationSec: 600 }, { audioDurationSec: 900 }, { audioDurationSec: null }];
  const r = computeSkillTiming('listening', { durationMinutes: 5, groups }, T0);
  eq(r.seconds, 1620, 'listening audio 600+900 => 1620s (durationMinutes=5 ignored)');
  eq(r.deadline?.getTime(), T0 + 1620_000, 'listening deadline anchored at start');
}

// 2. Listening without audio -> 30min fallback + 120s review.
{
  const r = computeSkillTiming('listening', { durationMinutes: 45, groups: [] }, T0);
  eq(r.seconds, 1920, 'listening no audio => 1920s fallback');
  const r2 = computeSkillTiming('listening', undefined, T0);
  eq(r2.seconds, 1920, 'listening missing section => 1920s fallback');
}

// 3. Reading: durationMinutes kept; default 60.
{
  const r = computeSkillTiming('reading', { durationMinutes: 45, groups: [] }, T0);
  eq(r.seconds, 2700, 'reading durationMinutes=45 => 2700s');
  eq(r.deadline?.getTime(), T0 + 2_700_000, 'reading deadline anchored at start');
  const d = computeSkillTiming('reading', { durationMinutes: null, groups: [] }, T0);
  eq(d.seconds, 3600, 'reading no duration => 60min default');
}

// 4. Writing: durationMinutes kept; default 60.
{
  const r = computeSkillTiming('writing', { durationMinutes: 30, groups: [] }, T0);
  eq(r.seconds, 1800, 'writing durationMinutes=30 => 1800s');
  const d = computeSkillTiming('writing', undefined, T0);
  eq(d.seconds, 3600, 'writing missing section => 60min default');
}

// 5. Speaking: never a deadline, even with durationMinutes set.
{
  const r = computeSkillTiming('speaking', { durationMinutes: 60, groups: [] }, T0);
  eq(r.seconds, null, 'speaking seconds null');
  eq(r.deadline, null, 'speaking deadline null');
}

// 6. single_skill orchestration shape: last timed section wins (speaking skipped).
{
  const bySkill = new Map([
    ['listening', { durationMinutes: null, groups: [{ audioDurationSec: 1500 }] }],
    ['speaking', { durationMinutes: 20, groups: [] }],
  ]);
  let last: Date | null = null;
  const map: Record<string, string> = {};
  for (const skill of SKILL_ORDER) {
    const section = bySkill.get(skill);
    if (!section) continue;
    const { deadline } = computeSkillTiming(skill, section, T0);
    if (!deadline) continue;
    map[skill] = deadline.toISOString();
    last = deadline;
  }
  eq(map, { listening: new Date(T0 + 1620_000).toISOString() }, 'single_skill map: listening only, speaking skipped');
  eq(last?.getTime(), T0 + 1620_000, 'single_skill overall = listening deadline');
}

// 7. Speaking-only exam: no deadlines at all.
{
  const bySkill = new Map([['speaking', { durationMinutes: 20, groups: [] }]]);
  let last: Date | null = null;
  for (const skill of SKILL_ORDER) {
    const section = bySkill.get(skill);
    if (!section) continue;
    const { deadline } = computeSkillTiming(skill, section, T0);
    if (!deadline) continue;
    last = deadline;
  }
  eq(last, null, 'speaking-only exam => overall null');
}

// 8. full_test chaining: L(1620s) -> R(60m) -> W(60m) sequential.
{
  const bySkill = new Map([
    ['listening', { durationMinutes: null, groups: [{ audioDurationSec: 1500 }] }],
    ['reading', { durationMinutes: 60, groups: [] }],
    ['writing', { durationMinutes: 60, groups: [] }],
  ]);
  let cursor = T0;
  for (const skill of ['listening', 'reading', 'writing'] as const) {
    const { seconds } = computeSkillTiming(skill, bySkill.get(skill), cursor);
    if (seconds == null) continue;
    cursor += seconds * 1000;
  }
  eq(cursor - T0, (1620 + 3600 + 3600) * 1000, 'full_test chained total preserved');
}

if (failures > 0) {
  console.error(`${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('ALL TIMING CHECKS PASSED');
