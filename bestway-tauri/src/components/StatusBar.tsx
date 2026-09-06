import type { ReactNode } from "react";

type Props = {
  sessionLabel: string;
  /** Right-side slot reserved for BatteryIndicator. */
  rightSlot?: ReactNode;
  /** When set, a Log out button is shown (authenticated state). */
  onLogout?: () => void;
};

export default function StatusBar({ sessionLabel, rightSlot, onLogout }: Props) {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between border-t border-white/10 bg-black/80 px-4 py-2 text-sm text-white/80 backdrop-blur">
      <span className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#38c765]" />
        {sessionLabel}
      </span>
      <span className="flex items-center gap-2">
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="btn-ghost rounded-lg px-3 py-1 text-xs text-white/80 hover:text-white"
          >
            Log out
          </button>
        )}
        {rightSlot}
      </span>
    </footer>
  );
}
