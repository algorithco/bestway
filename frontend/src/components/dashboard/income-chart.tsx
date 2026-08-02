"use client";

import { useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { IncomePoint } from "@/lib/types";
import { formatMoney } from "@/lib/utils";

export function IncomeChart({ data }: { data: IncomePoint[] }) {
  const tm = useTranslations("monthsShort");
  const tp = useTranslations("payments");

  const chartData = data.map((d) => ({
    ...d,
    label: tm(String(d.month)),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.35} />
            <stop offset="55%" stopColor="var(--accent)" stopOpacity={0.12} />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="incomeStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--brand)" />
            <stop offset="100%" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--fg-muted)", fontSize: 12 }}
          dy={6}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          tick={{ fill: "var(--fg-muted)", fontSize: 12 }}
          tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
        />
        <Tooltip
          cursor={{ stroke: "var(--border-strong)" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const income = payload[0].value as number;
            return (
              <div className="rounded-[8px] border border-border bg-surface px-3 py-2 text-sm shadow-lg">
                <p className="font-medium text-fg">{label}</p>
                <p className="text-fg-muted">
                  {tp("income")}:{" "}
                  <span className="font-semibold text-brand">{formatMoney(income)}</span>{" "}
                  <span className="text-xs">so&apos;m</span>
                </p>
              </div>
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="income"
          stroke="url(#incomeStroke)"
          strokeWidth={2.5}
          fill="url(#incomeFill)"
          dot={{ r: 3, fill: "var(--brand)", strokeWidth: 0 }}
          activeDot={{ r: 6, fill: "var(--brand)", stroke: "var(--surface)", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
