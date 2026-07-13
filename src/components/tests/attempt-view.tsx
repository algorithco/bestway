"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { TestRunner } from "@/components/tests/test-runner";
import { AttemptReview } from "@/components/tests/attempt-review";
import { useAttempt } from "@/hooks/use-tests";

export function AttemptView({ attemptId }: { attemptId: string }) {
  const tc = useTranslations("common");
  const { data, isLoading, isError, refetch } = useAttempt(attemptId);

  if (isError) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState
          title={tc("error")}
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {tc("retry")}
            </Button>
          }
        />
      </div>
    );
  }
  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return data.status === "in_progress" ? (
    <TestRunner attempt={data} />
  ) : (
    <AttemptReview attempt={data} />
  );
}
