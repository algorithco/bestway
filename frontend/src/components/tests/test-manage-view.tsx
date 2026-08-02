"use client";

import * as React from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { QuestionFormDialog } from "@/components/tests/question-form-dialog";
import { useTest, useDeleteQuestion } from "@/hooks/use-tests";
import type { TestSection } from "@/lib/types";

const SECTION_ORDER: TestSection[] = ["listening", "reading", "writing", "speaking"];

export function TestManageView({ testId }: { testId: string }) {
  const t = useTranslations("tests");
  const tc = useTranslations("common");
  const { data: test, isLoading, isError, refetch } = useTest(testId);
  const del = useDeleteQuestion(testId);
  const [addOpen, setAddOpen] = React.useState(false);

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState title={tc("error")} action={<Button variant="outline" size="sm" onClick={() => refetch()}>{tc("retry")}</Button>} />
      </div>
    );
  }
  if (isLoading || !test) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const questions = test.questions ?? [];

  function onDelete(id: string) {
    del.mutate(id, {
      onSuccess: () => toast.success(tc("saved")),
      onError: () => toast.error(tc("unknownError")),
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/tests" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-fg">
        <ArrowLeft className="size-4" />
        {t("title")}
      </Link>

      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="brand">{test.type.toUpperCase()}</Badge>
            {test.isDemo && <Badge variant="info">{t("demo")}</Badge>}
            {test.level && <span className="text-xs text-fg-muted">{test.level}</span>}
          </div>
          <h1 className="mt-1.5 text-xl font-bold tracking-tight text-fg">{test.title}</h1>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus />
          {t("addQuestion")}
        </Button>
      </div>

      {questions.length === 0 ? (
        <EmptyState title={tc("empty")} description={t("addQuestion")} />
      ) : (
        <div className="space-y-4">
          {SECTION_ORDER.filter((s) => questions.some((q) => q.section === s)).map((section) => (
            <Card key={section}>
              <CardHeader>
                <CardTitle className="text-sm">{t(`sections.${section}`)}</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border">
                {questions
                  .filter((q) => q.section === section)
                  .map((q) => (
                    <div key={q.id} className="flex items-start justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="neutral">{t(`types.${q.type}`)}</Badge>
                          <span className="text-xs text-fg-subtle">{q.maxScore} {t("score")}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-fg">{q.prompt}</p>
                        {q.correctAnswer && (
                          <p className="mt-0.5 text-xs text-success">✓ {q.correctAnswer}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={tc("delete")}
                        onClick={() => onDelete(q.id)}
                      >
                        <Trash2 className="text-danger" />
                      </Button>
                    </div>
                  ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <QuestionFormDialog open={addOpen} onClose={() => setAddOpen(false)} testId={testId} />
    </div>
  );
}
