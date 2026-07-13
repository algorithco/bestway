"use client";

import * as React from "react";
import { Check, ChevronLeft, ChevronRight, Clock, Users, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/app/page-header";
import { ExportButton } from "@/components/app/export-button";
import { DataGrid, type DataGridColumn } from "@/components/data-grid/data-grid";
import { StateCell, type CellTone } from "@/components/data-grid/state-cell";
import { useGroups, useGroupDetail } from "@/hooks/use-groups";
import { useAttendance, useSaveAttendanceCell } from "@/hooks/use-attendance";
import type { AttendanceState, ScheduleItem } from "@/lib/types";
import { currentMonthKey, daysInMonth, toDateKey } from "@/lib/utils";

const WD_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const DEFAULT_DAYS = new Set(["mon", "tue", "wed", "thu", "fri", "sat"]);

const STATE_VIEW: Record<AttendanceState, { tone: CellTone; Icon: typeof Check }> = {
  present: { tone: "success", Icon: Check },
  absent: { tone: "danger", Icon: X },
  late: { tone: "warning", Icon: Clock },
};

function nextState(cur?: AttendanceState): AttendanceState {
  if (cur === "present") return "absent";
  if (cur === "absent") return "late";
  if (cur === "late") return "present";
  return "present";
}

function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function scheduleDaySet(schedule: ScheduleItem[] | null): Set<string> {
  if (!schedule || schedule.length === 0) return DEFAULT_DAYS;
  return new Set(schedule.map((s) => s.day));
}

export function AttendancePanel() {
  const t = useTranslations("attendance");
  const tc = useTranslations("common");
  const tMonths = useTranslations("months");
  const tWd = useTranslations("weekdaysShort");
  const params = useSearchParams();

  const groupsQ = useGroups();
  const [groupId, setGroupId] = React.useState<string>("");
  const [month, setMonth] = React.useState<string>(currentMonthKey());

  // Boshlang'ich guruh: ?group= yoki ro'yxatdagi birinchisi
  React.useEffect(() => {
    if (groupId || !groupsQ.data?.length) return;
    const wanted = params.get("group");
    const exists = wanted && groupsQ.data.some((g) => g.id === wanted);
    setGroupId(exists ? wanted! : groupsQ.data[0].id);
  }, [groupsQ.data, groupId, params]);

  const detailQ = useGroupDetail(groupId || undefined);
  const attendanceQ = useAttendance(groupId || undefined, month);
  const save = useSaveAttendanceCell(groupId, month);

  const students = detailQ.data?.students ?? [];

  const columns: DataGridColumn[] = React.useMemo(() => {
    const days = scheduleDaySet(detailQ.data?.schedule ?? null);
    const [y, m] = month.split("-").map(Number);
    const total = daysInMonth(y, m);
    const todayKey = toDateKey(new Date());
    const cols: DataGridColumn[] = [];
    for (let d = 1; d <= total; d++) {
      const date = new Date(Date.UTC(y, m - 1, d));
      const wd = WD_KEYS[date.getUTCDay()];
      if (!days.has(wd)) continue;
      const dateStr = `${month}-${String(d).padStart(2, "0")}`;
      cols.push({
        id: dateStr,
        width: 48,
        highlight: dateStr === todayKey,
        header: (
          <div className="flex flex-col items-center leading-tight">
            <span className="text-[13px] font-semibold text-fg">{d}</span>
            <span className="text-[10px] font-normal">{tWd(wd)}</span>
          </div>
        ),
      });
    }
    return cols;
  }, [detailQ.data?.schedule, month, tWd]);

  // Tez qidiruv uchun: "studentId|date" -> state
  const stateMap = React.useMemo(() => {
    const map = new Map<string, AttendanceState>();
    for (const r of attendanceQ.data ?? []) map.set(`${r.studentId}|${r.date}`, r.state);
    return map;
  }, [attendanceQ.data]);

  function commit(studentId: string, date: string, state: AttendanceState) {
    save.mutate(
      { studentId, date, state },
      { onError: () => toast.error(t("saveError")) },
    );
  }

  const monthLabel = `${tMonths(String(Number(month.split("-")[1])))} ${month.split("-")[0]}`;

  return (
    <div className="mx-auto max-w-full">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <>
            {groupId && (
              <ExportButton path={`/stats/export/attendance?groupId=${groupId}&month=${month}`} />
            )}
            {groupsQ.data && groupsQ.data.length > 0 && (
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder={t("selectGroup")} />
                </SelectTrigger>
                <SelectContent>
                  {groupsQ.data.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </>
        }
      />

      {groupsQ.isError ? (
        <ErrorState
          title={tc("error")}
          action={
            <Button variant="outline" size="sm" onClick={() => groupsQ.refetch()}>
              {tc("retry")}
            </Button>
          }
        />
      ) : groupsQ.isLoading ? (
        <Skeleton className="h-72" />
      ) : (groupsQ.data?.length ?? 0) === 0 ? (
        <EmptyState icon={Users} title={t("noGroups")} />
      ) : (
        <>
          {/* Oy navigatsiyasi + belgilar */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setMonth((mo) => shiftMonth(mo, -1))}
                aria-label={tc("back")}
              >
                <ChevronLeft />
              </Button>
              <span className="min-w-36 text-center text-sm font-semibold text-fg">
                {monthLabel}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setMonth((mo) => shiftMonth(mo, 1))}
                aria-label={tc("next")}
              >
                <ChevronRight />
              </Button>
            </div>
            <Legend />
          </div>

          {detailQ.isLoading || attendanceQ.isLoading ? (
            <Skeleton className="h-72" />
          ) : students.length === 0 ? (
            <EmptyState icon={Users} title={tc("empty")} />
          ) : columns.length === 0 ? (
            <EmptyState icon={Clock} title={tc("empty")} />
          ) : (
            <>
              <DataGrid
                columns={columns}
                rows={students.map((s) => ({
                  id: s.studentId,
                  header: <span className="truncate">{s.name}</span>,
                }))}
                corner={tc("student")}
                renderCell={(studentId, date) => {
                  const cur = stateMap.get(`${studentId}|${date}`);
                  const view = cur ? STATE_VIEW[cur] : null;
                  return (
                    <StateCell
                      tone={view?.tone ?? "neutral"}
                      title={cur ? t(cur) : t("notMarked")}
                      onClick={() => commit(studentId, date, nextState(cur))}
                      onKeyDown={(e) => {
                        const k = e.key.toLowerCase();
                        if (k === "k") commit(studentId, date, "present");
                        else if (k === "n") commit(studentId, date, "absent");
                        else if (k === "s") commit(studentId, date, "late");
                      }}
                    >
                      {view ? <view.Icon /> : <span className="text-fg-subtle">·</span>}
                    </StateCell>
                  );
                }}
              />
              <p className="mt-3 text-xs text-fg-subtle">{t("keyboardHint")}</p>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Legend() {
  const t = useTranslations("attendance");
  const items: { state: AttendanceState }[] = [
    { state: "present" },
    { state: "absent" },
    { state: "late" },
  ];
  return (
    <div className="flex items-center gap-3 text-xs text-fg-muted">
      {items.map(({ state }) => {
        const { tone, Icon } = STATE_VIEW[state];
        const bg = {
          success: "bg-success-bg text-success",
          danger: "bg-danger-bg text-danger",
          warning: "bg-warning-bg text-warning",
          info: "bg-info-bg text-info",
          neutral: "bg-bg-subtle text-fg-subtle",
        }[tone];
        return (
          <span key={state} className="inline-flex items-center gap-1.5">
            <span className={`inline-flex size-5 items-center justify-center rounded ${bg} [&_svg]:size-3.5`}>
              <Icon />
            </span>
            {t(state)}
          </span>
        );
      })}
    </div>
  );
}
