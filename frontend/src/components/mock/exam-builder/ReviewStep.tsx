"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isAutoType, type BuilderDraft, type BuilderPart } from "./types";

/**
 * A4 — exam-builder review step: read-only summary + publish trigger.
 *
 * Publish itself stays in the wizard: the button only calls `onPublish`,
 * which runs `useUpdateMockExam({ isPublished: true })` there.
 */

export interface ReviewStepProps {
  draft: BuilderDraft;
  onPublish: () => void;
  publishing: boolean;
  onBack: () => void;
}

/** Auto-graded questions without any correct answer; manual kinds never miss. */
function missingInPart(part: BuilderPart): number {
  return part.questions.filter(
    (q) => isAutoType(q.type) && !q.correctAnswers.some((a) => a.trim() !== ""),
  ).length;
}

export function ReviewStep({ draft, onPublish, publishing, onBack }: ReviewStepProps) {
  const tw = useTranslations("wizard");
  const tc = useTranslations("common");
  const tm = useTranslations("mock");

  const stats = draft.sections.map((section) => {
    const questionCount = section.parts.reduce((n, p) => n + p.questions.length, 0);
    const missing = section.parts.reduce((n, p) => n + missingInPart(p), 0);
    return { section, parts: section.parts.length, questionCount, missing };
  });
  const totalQuestions = stats.reduce((n, s) => n + s.questionCount, 0);
  const totalMissing = stats.reduce((n, s) => n + s.missing, 0);
  const ready = totalQuestions > 0 && totalMissing === 0;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="font-semibold text-fg">{tw("review")}</h3>
        <p className="text-sm text-fg-muted">{tw("reviewHint")}</p>
      </div>

      <div className="space-y-3">
        {stats.map((s, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle>{tm(`skills.${s.section.skill}`)}</CardTitle>
                {s.missing === 0 ? (
                  <Badge variant="success">✓</Badge>
                ) : (
                  <Badge variant="danger">
                    ✗ {s.missing} {tw("missingAnswers")}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="text-fg-muted">
                {s.parts} {tm("block")} · {s.questionCount} {tm("questions")}
              </p>
              <p className={s.missing === 0 ? "font-medium text-success" : "font-medium text-danger"}>
                {s.missing === 0 ? "✓" : "✗"} {tw("missingAnswers")}
                {s.missing > 0 ? `: ${s.missing}` : ""}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className={`text-sm font-medium ${ready ? "text-success" : "text-danger"}`}>
        {ready ? `✓ ${tw("readyToPublish")}` : `✗ ${tw("notReady")}`}
      </p>

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={onBack}>
          {tc("back")}
        </Button>
        <Button onClick={onPublish} loading={publishing}>
          {publishing ? tc("save") : tw("publishNow")}
        </Button>
      </div>
    </div>
  );
}
