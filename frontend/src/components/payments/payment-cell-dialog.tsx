"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import type { PaymentState } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface PaymentCellTarget {
  studentId: string;
  studentName: string;
  month: number;
  state?: PaymentState;
  amount: number;
  note: string | null;
}

const STATES: PaymentState[] = ["paid", "partial", "unpaid"];

const stateStyle: Record<PaymentState, string> = {
  paid: "border-success bg-success-bg text-success",
  partial: "border-warning bg-warning-bg text-warning",
  unpaid: "border-danger bg-danger-bg text-danger",
};

export function PaymentCellDialog({
  target,
  onClose,
  onSave,
  defaultAmount,
}: {
  target: PaymentCellTarget | null;
  onClose: () => void;
  onSave: (values: { state: PaymentState; amount: number; note: string }) => void;
  defaultAmount: number;
}) {
  const t = useTranslations("payments");
  const tc = useTranslations("common");
  const tMonths = useTranslations("months");

  const [state, setState] = React.useState<PaymentState>("paid");
  const [amount, setAmount] = React.useState<string>("");
  const [note, setNote] = React.useState<string>("");

  // Modal ochilganda katakning joriy qiymatlari bilan to'ldiramiz
  React.useEffect(() => {
    if (!target) return;
    const initial = target.state ?? "paid";
    setState(initial);
    setAmount(String(target.amount || (initial === "paid" ? defaultAmount : 0) || ""));
    setNote(target.note ?? "");
  }, [target, defaultAmount]);

  function submit() {
    if (!target) return;
    onSave({ state, amount: Number(amount) || 0, note: note.trim() });
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {target ? t("editCell", { month: tMonths(String(target.month)), name: target.studentName }) : ""}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <Field label={tc("confirm")}>
            <div className="grid grid-cols-3 gap-2">
              {STATES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setState(s);
                    if (s === "paid" && (!amount || amount === "0")) setAmount(String(defaultAmount || ""));
                    if (s === "unpaid") setAmount("0");
                  }}
                  aria-pressed={state === s}
                  className={cn(
                    "rounded-[8px] border px-3 py-2 text-sm font-medium transition-colors",
                    state === s
                      ? stateStyle[s]
                      : "border-border bg-surface text-fg-muted hover:bg-surface-hover",
                  )}
                >
                  {t(s)}
                </button>
              ))}
            </div>
          </Field>

          <Field label={`${t("amount")} (${tc("sum")})`} htmlFor="amount">
            <Input
              id="amount"
              type="number"
              inputMode="numeric"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </Field>

          <Field label={t("note")} htmlFor="note">
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("notePlaceholder")}
              maxLength={500}
            />
          </Field>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button onClick={submit}>{tc("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
