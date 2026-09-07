"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/app/page-header";
import { useIeltsBands, useResetIeltsBands, useSettings, useUpdateIeltsBands, useUpdateSettings } from "@/hooks/use-settings";
import type { BandTable, IeltsBandsResponse, Settings } from "@/lib/types";

export function SettingsView() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const { data, isLoading, isError, refetch } = useSettings();
  const bands = useIeltsBands();

  const failed = isError || bands.isError;
  const loading = isLoading || !data || bands.isLoading || !bands.data;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {failed ? (
        <ErrorState
          title={tc("error")}
          action={
            <Button variant="outline" size="sm" onClick={() => { refetch(); bands.refetch(); }}>
              {tc("retry")}
            </Button>
          }
        />
      ) : loading ? (
        <Skeleton className="h-80" />
      ) : (
        <>
          <SettingsForm
            key={`${data.teacherPointLimit}|${data.initialPoints}|${data.monthlyFee}|${data.gameThreshold}`}
            data={data}
          />
          <BandsForm
            key={JSON.stringify(bands.data)}
            data={bands.data}
          />
        </>
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

/** IELTS xom→band jadvallari (super_admin, equating uchun tahrirlanadi) */
function BandsForm({ data }: { data: IeltsBandsResponse }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const update = useUpdateIeltsBands();
  const reset = useResetIeltsBands();

  const [listening, setListening] = React.useState<BandTable>(data.listening);
  const [readingAcademic, setReadingAcademic] = React.useState<BandTable>(data.readingAcademic);
  const [readingGeneral, setReadingGeneral] = React.useState<BandTable>(data.readingGeneral);

  function save() {
    update.mutate(
      { listening, readingAcademic, readingGeneral },
      {
        onSuccess: () => toast.success(t("saved")),
        onError: (e) => toast.error((e as Error)?.message || tc("unknownError")),
      },
    );
  }

  function onReset() {
    if (!confirm(t("bandsResetConfirm"))) return;
    reset.mutate(undefined, {
      onSuccess: (fresh) => {
        setListening(fresh.listening);
        setReadingAcademic(fresh.readingAcademic);
        setReadingGeneral(fresh.readingGeneral);
        toast.success(t("saved"));
      },
      onError: (e) => toast.error((e as Error)?.message || tc("unknownError")),
    });
  }

  return (
    <Card>
      <CardContent className="space-y-5 pt-5">
        <div>
          <h2 className="text-sm font-semibold text-fg">{t("bandsTitle")}</h2>
          <p className="mt-0.5 text-xs text-fg-muted">{t("bandsHint")}</p>
        </div>
        <BandTableEditor
          label={t("bandsListening")}
          customized={data.customized.listening}
          value={listening}
          onChange={setListening}
        />
        <BandTableEditor
          label={t("bandsReadingAcademic")}
          customized={data.customized.readingAcademic}
          value={readingAcademic}
          onChange={setReadingAcademic}
        />
        <BandTableEditor
          label={t("bandsReadingGeneral")}
          customized={data.customized.readingGeneral}
          value={readingGeneral}
          onChange={setReadingGeneral}
        />
        <div className="flex justify-between border-t border-border pt-4">
          <Button variant="outline" onClick={onReset} loading={reset.isPending}>
            {t("bandsReset")}
          </Button>
          <Button onClick={save} loading={update.isPending}>
            {tc("save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BandTableEditor({
  label,
  customized,
  value,
  onChange,
}: {
  label: string;
  customized: boolean;
  value: BandTable;
  onChange: (v: BandTable) => void;
}) {
  const t = useTranslations("settings");

  function setRow(index: number, col: 0 | 1, raw: string) {
    const n = Number(raw);
    if (Number.isNaN(n)) return;
    onChange(value.map((row, i) => (i === index ? ([col === 0 ? n : row[0], col === 1 ? n : row[1]] as [number, number]) : row)));
  }

  function removeRow(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function addRow() {
    onChange([...value, [0, 0]]);
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-fg-muted">
        {label}
        {customized && <span className="ml-2 text-xs text-brand">· {t("bandsCustom")}</span>}
      </p>
      <div className="space-y-1.5">
        {value.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={40}
              step={1}
              value={row[0]}
              onChange={(e) => setRow(i, 0, e.target.value)}
              className="h-8 w-20"
              aria-label={`${label} minRaw ${i + 1}`}
            />
            <span className="text-xs text-fg-subtle">→</span>
            <Input
              type="number"
              min={0}
              max={9}
              step={0.5}
              value={row[1]}
              onChange={(e) => setRow(i, 1, e.target.value)}
              className="h-8 w-20"
              aria-label={`${label} band ${i + 1}`}
            />
            <Button size="sm" variant="ghost" onClick={() => removeRow(i)}>
              ×
            </Button>
          </div>
        ))}
      </div>
      <Button size="sm" variant="outline" onClick={addRow} className="mt-2">
        + {t("bandsAddRow")}
      </Button>
    </div>
  );
}
