import { post } from "./api";

export type CheatKind = "tab_switch" | "blur" | "paste" | "shortcut";
export type CheatScope = "tests" | "mock";

/**
 * Report a cheating signal for an attempt.
 * - scope "tests" -> POST /tests/attempts/:id/flag-cheat
 * - scope "mock"  -> POST /mock/attempts/:id/flag-cheat
 *
 * Fire-and-forget from the lockdown window event handlers; resolves when acked.
 */
export function reportCheat(
  attemptId: string,
  kind: CheatKind,
  scope: CheatScope,
): Promise<void> {
  const base = scope === "tests" ? "/tests/attempts" : "/mock/attempts";
  return post<void>(`${base}/${encodeURIComponent(attemptId)}/flag-cheat`, {
    kind,
    at: new Date().toISOString(),
  });
}
