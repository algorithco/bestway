import type { ReactNode } from "react";

type Props = {
  sessionLabel: string;
  /** Right-side slot reserved for BatteryIndicator (owned elsewhere — do not implement here). */
  rightSlot?: ReactNode;
};

export default function StatusBar({ sessionLabel, rightSlot }: Props) {
  return (
    <footer className="fixed inset-x-0 bottom-0 flex items-center justify-between border-t bg-white px-4 py-2 text-sm">
      <span className="text-slate-600">{sessionLabel}</span>
      <span className="flex items-center gap-2">{rightSlot}</span>
    </footer>
  );
}
