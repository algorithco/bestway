"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/app/page-header";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import type { Settings } from "@/lib/types";

export function SettingsView() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const { data, isLoading, isError, refetch } = useSettings();

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {isError ? (
        <ErrorState
          title={tc("error")}
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {tc("retry")}
            </Button>
          }
        />
      ) : isLoading || !data ? (
        <Skeleton className="h-80" />
      ) : (
        <SettingsForm
          key={`${data.teacherPointLimit}|${data.initialPoints}|${data.monthlyFee}|${data.gameThreshold}`}
          data={data}
        />
      )}
    </div>
  );
}

function SettingsForm({ data }: { data: Settings }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const update = useUpdateSettings();

  const [form, setForm] = React.useState({
    teacherPointLimit: String(data.teacherPointLimit),
    initialPoints: String(data.initialPoints),
    monthlyFee: String(data.monthlyFee),
    gameThreshold: String(data.gameThreshold),
  });

  function save() {
    update.mutate(
      {
        teacherPointLimit: Number(form.teacherPointLimit) || 0,
        initialPoints: Number(form.initialPoints) || 0,
        monthlyFee: Number(form.monthlyFee) || 0,
        gameThreshold: Number(form.gameThreshold) || 0,
      },
      {
        onSuccess: () => toast.success(t("saved")),
        onError: () => toast.error(tc("unknownError")),
      },
    );
  }

  return (
    <Card>
      <CardContent className="space-y-5 pt-5">
        <Field label={t("teacherPointLimit")} hint={t("teacherPointLimitHint")} htmlFor="tpl">
          <Input
            id="tpl"
            type="number"
            min={0}
            value={form.teacherPointLimit}
            onChange={(e) => setForm((f) => ({ ...f, teacherPointLimit: e.target.value }))}
          />
        </Field>
        <Field label={t("initialPoints")} hint={t("initialPointsHint")} htmlFor="ip">
          <Input
            id="ip"
            type="number"
            min={0}
            value={form.initialPoints}
            onChange={(e) => setForm((f) => ({ ...f, initialPoints: e.target.value }))}
          />
        </Field>
        <Field label={t("monthlyFee")} hint={t("monthlyFeeHint")} htmlFor="mf">
          <Input
            id="mf"
            type="number"
            min={0}
            value={form.monthlyFee}
            onChange={(e) => setForm((f) => ({ ...f, monthlyFee: e.target.value }))}
          />
        </Field>

        <Field label={t("gameThreshold")} hint={t("gameThresholdHint")} htmlFor="gt">
          <Input
            id="gt"
            type="number"
            min={1}
            value={form.gameThreshold}
            onChange={(e) => setForm((f) => ({ ...f, gameThreshold: e.target.value }))}
          />
        </Field>

        <div className="flex justify-end border-t border-border pt-4">
          <Button onClick={save} loading={update.isPending}>
            {tc("save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
