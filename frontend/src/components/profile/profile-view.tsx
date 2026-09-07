"use client";

import { Check, Link2, Loader2, Send, Unlink } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/app/page-header";
import { useMe } from "@/hooks/use-me";
import {
  useTelegramLinkToken,
  useTelegramStatus,
  useUnlinkTelegram,
} from "@/hooks/use-telegram";
import { ApiError } from "@/lib/api-client";
import { formatPhone, isSafeHref } from "@/lib/utils";

export function ProfileView() {
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const tr = useTranslations("roles");
  const format = useFormatter();
  const { data: me, isLoading } = useMe();
  const statusQ = useTelegramStatus();
  const linkToken = useTelegramLinkToken();
  const unlink = useUnlinkTelegram();

  function onLink() {
    linkToken.mutate(undefined, {
      onSuccess: (res) => {
        // Backend'dan kelgan URL — sxemani tekshiramiz (javascript: va sh.k. bloklanadi)
        if (!isSafeHref(res.url)) {
          toast.error(tc("unknownError"));
          return;
        }
        window.open(res.url, "_blank", "noopener,noreferrer");
        toast.success(t("telegramHint"));
      },
      onError: (e) => toast.error(e instanceof ApiError ? e.message : tc("unknownError")),
    });
  }

  function onUnlink() {
    unlink.mutate(undefined, {
      onSuccess: () => toast.success(t("telegramNotLinked")),
      onError: () => toast.error(tc("unknownError")),
    });
  }

  if (isLoading || !me) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title={t("title")} />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const linked = statusQ.data?.linked ?? me.telegramLinked;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title={t("title")} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("account")}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar name={me.user.name} size="lg" />
          <div className="min-w-0">
            <p className="text-lg font-semibold text-fg">{me.user.name}</p>
            <p className="text-sm text-fg-muted">{formatPhone(me.user.phone)}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <Badge variant="brand">{tr(me.user.role)}</Badge>
              <span className="text-xs text-fg-subtle">
                {format.dateTime(new Date(me.user.createdAt), {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Send className="size-4 text-info" />
            {t("telegram")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-fg-muted">{t("telegramHint")}</p>
          {linked ? (
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm font-medium text-success">
                <Check className="size-4" />
                {t("telegramLinked")}
              </span>
              <Button variant="outline" size="sm" loading={unlink.isPending} onClick={onUnlink}>
                <Unlink />
                {t("unlinkTelegram")}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-fg-muted">{t("telegramNotLinked")}</span>
              <Button size="sm" loading={linkToken.isPending} onClick={onLink}>
                {linkToken.isPending ? <Loader2 className="animate-spin" /> : <Link2 />}
                {t("linkTelegram")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
