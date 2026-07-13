"use client";

import * as React from "react";
import { AlertTriangle, FileText, ListChecks, Pencil, Plus, Settings2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/app/page-header";
import { TestFormDialog } from "@/components/tests/test-form-dialog";
import { useTests, useAttempts } from "@/hooks/use-tests";
import { useMe } from "@/hooks/use-me";
import type { TestListItem } from "@/lib/types";

export function StaffTestsView() {
  const t = useTranslations("tests");
  const tc = useTranslations("common");
  const format = useFormatter();
  const { data: me } = useMe();
  const isOffice = me?.user.role === "admin" || me?.user.role === "super_admin";

  const [tab, setTab] = React.useState<"manage" | "grading">(isOffice ? "manage" : "grading");
  const testsQ = useTests();
  const gradingQ = useAttempts("grading");
  const [dialog, setDialog] = React.useState<{ open: boolean; test: TestListItem | null }>({
    open: false,
    test: null,
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t("title")}
        actions={
          isOffice && tab === "manage" ? (
            <Button size="sm" onClick={() => setDialog({ open: true, test: null })}>
              <Plus />
              {t("create")}
            </Button>
          ) : undefined
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "manage" | "grading")} className="mb-4">
        <TabsList>
          {isOffice && <TabsTrigger value="manage">{t("manage")}</TabsTrigger>}
          <TabsTrigger value="grading">{t("grading")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "manage" && isOffice ? (
        testsQ.isError ? (
          <ErrorState title={tc("error")} action={<Button variant="outline" size="sm" onClick={() => testsQ.refetch()}>{tc("retry")}</Button>} />
        ) : testsQ.isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : (testsQ.data?.length ?? 0) === 0 ? (
          <EmptyState icon={FileText} title={t("noTests")} />
        ) : (
          <div className="space-y-2">
            {testsQ.data!.map((test) => (
              <Card key={test.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="brand">{test.type.toUpperCase()}</Badge>
                    {test.isDemo && <Badge variant="info">{t("demo")}</Badge>}
                    {!test.isActive && <Badge variant="neutral">{tc("no")}</Badge>}
                  </div>
                  <p className="mt-1.5 truncate font-medium text-fg">{test.title}</p>
                  <p className="flex items-center gap-1 text-xs text-fg-muted">
                    <ListChecks className="size-3.5" />
                    {test.questionCount} {t("questions")}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label={tc("edit")} onClick={() => setDialog({ open: true, test })}>
                    <Pencil />
                  </Button>
                  <Button asChild variant="ghost" size="icon-sm" aria-label={t("addQuestion")}>
                    <Link href={`/tests/${test.id}`}>
                      <Settings2 />
                    </Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : gradingQ.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (gradingQ.data?.length ?? 0) === 0 ? (
        <EmptyState icon={FileText} title={t("noGrading")} />
      ) : (
        <div className="space-y-2">
          {gradingQ.data!.map((a) => (
            <Link key={a.id} href={`/tests/attempt/${a.id}`}>
              <Card className="flex items-center justify-between gap-3 p-4 transition-colors hover:border-border-strong">
                <div className="min-w-0">
                  <p className="truncate font-medium text-fg">{a.studentName}</p>
                  <p className="truncate text-xs text-fg-muted">{a.testTitle}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {a.antiCheatCount > 0 && (
                    <span className="flex items-center gap-1 text-xs text-warning">
                      <AlertTriangle className="size-3.5" />
                      {a.antiCheatCount}
                    </span>
                  )}
                  <span className="text-xs text-fg-subtle">
                    {format.dateTime(new Date(a.startedAt), { day: "numeric", month: "short" })}
                  </span>
                  <Badge variant="warning">{t("statusLabel.grading")}</Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <TestFormDialog
        open={dialog.open}
        test={dialog.test}
        onClose={() => setDialog({ open: false, test: null })}
      />
    </div>
  );
}
