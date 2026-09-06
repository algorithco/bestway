"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { useMockAttempt } from "@/hooks/use-mock";
import { useMe } from "@/hooks/use-me";
import { MockRunner } from "@/components/mock/mock-runner";
import { MockResultView } from "@/components/mock/mock-result-view";

export function MockAttemptClient({ attemptId }: { attemptId: string }) {
  const tc = useTranslations("common");
  const { data, isLoading, isError, refetch } = useMockAttempt(attemptId);
  const { data: me } = useMe();
  const role = me?.user.role;
  const isStaff = role === "teacher" || role === "admin" || role === "super_admin";

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl">
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
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-14" />
        <Skeleton className="h-72" />
      </div>
    );
  }
  // Xodimga runner emas, kuzatuv + boshqaruv (force-submit/extend/reopen/delete) ko'rinadi.
  if (data.status === "in_progress" && !isStaff) return <MockRunner attempt={data} />;
  return <MockResultView attempt={data} />;
}
