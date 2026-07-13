"use client";

import { BookOpen, ChevronRight, Star, UserPlus, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/app/page-header";
import { useMe } from "@/hooks/use-me";
import type { ParentSelfProfile } from "@/lib/types";

export function ParentDashboard() {
  const t = useTranslations("dashboard");
  const tp = useTranslations("parent");
  const ts = useTranslations("student");
  const tc = useTranslations("common");
  const { data: me, isLoading } = useMe();

  const firstName = me?.user.name.split(" ")[0] ?? "";
  const profile =
    me?.profile && "children" in me.profile ? (me.profile as ParentSelfProfile) : null;
  const children = profile?.children ?? [];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t("greeting", { name: firstName })}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/children">
              <UserPlus />
              {tp("addChild")}
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : children.length === 0 ? (
        <EmptyState
          icon={Users}
          title={tp("noChildren")}
          description={tp("noChildrenHint")}
          action={
            <Button asChild size="sm">
              <Link href="/children">
                <UserPlus />
                {tp("addChild")}
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {children.map((c) => (
            <Link key={c.studentId} href={`/children?child=${c.studentId}`}>
              <Card className="p-5 transition-colors hover:border-border-strong">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-fg">{c.name}</p>
                  {!c.isApproved && (
                    <Badge variant="warning">{ts("notApproved")}</Badge>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-4 text-sm text-fg-muted">
                  <span className="flex items-center gap-1.5">
                    <Star className="size-4 text-brand" />
                    {c.currentPoints}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="size-4" />
                    {c.groupName ?? ts("noGroup")}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-end text-sm font-medium text-brand">
                  {tc("next")}
                  <ChevronRight className="size-4" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
