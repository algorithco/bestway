import { useBattery } from "../hooks/useBattery";

export type BatteryLang = "uz" | "ru" | "en";

export interface BatteryLabels {
  battery: string;
  charging: string;
  unknown: string;
}

const LABELS: Record<BatteryLang, BatteryLabels> = {
  uz: { battery: "Batareya", charging: "Quvvatlanmoqda", unknown: "Nomaʼlum" },
  ru: { battery: "Батарея", charging: "Заряжается", unknown: "Неизвестно" },
  en: { battery: "Battery", charging: "Charging", unknown: "Unknown" },
};

export interface BatteryIndicatorProps {
  /** Compact mode: icon + percent only, no text label. @default false */
  compact?: boolean;
  /** i18n language for built-in labels. @default "uz" */
  lang?: BatteryLang;
  /** Override any built-in label. Merged over the `lang` preset. */
  labels?: Partial<BatteryLabels>;
  /**
   * When true (default) the widget is `fixed bottom-right` so it is safe
   * to render standalone. Set to false when the parent StatusBar handles
   * positioning — then it renders as a plain inline flex row.
   */
  standalone?: boolean;
  /** Extra class names appended to the root element. */
  className?: string;
  /** Accessible label override. Defaults to "<battery>: <percent>%". */
  ariaLabel?: string;
}

function PlugIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 7V3" />
      <path d="M15 7V3" />
      <path d="M7 7h10v5a5 5 0 0 1-10 0V7z" />
      <path d="M12 17v4" />
    </svg>
  );
}

function BatteryIcon({
  percent,
  size = 18,
}: {
  percent: number | null;
  size?: number;
}) {
  const level = percent === null ? 0 : Math.max(0, Math.min(100, percent));
  const bars = level >= 80 ? 4 : level >= 50 ? 3 : level >= 20 ? 2 : 1;
  return (
    <svg
      width={size + 6}
      height={size}
      viewBox="0 0 28 18"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x={1}
        y={1}
        width={22}
        height={16}
        rx={3}
        stroke="currentColor"
        strokeWidth={1.5}
        opacity={0.6}
      />
      <rect x={24.5} y={6} width={2.5} height={6} rx={1} fill="currentColor" opacity={0.6} />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={4 + i * 4.5}
          y={11.5 - (i < bars ? 4 + i : 0)}
          width={3}
          height={i < bars ? 4 + i : 1.5}
          rx={0.75}
          fill="currentColor"
          opacity={percent === null ? 0.25 : i < bars ? 1 : 0.2}
        />
      ))}
    </svg>
  );
}

/**
 * Fixed bottom-right battery widget.
 *
 * Detection order (see `useBattery`): Tauri `invoke('get_battery')`
 * -> `navigator.getBattery()` -> unknown ("—%").
 * Polls every 30s; click the widget to refresh on demand.
 */
export function BatteryIndicator({
  compact = false,
  lang = "uz",
  labels,
  standalone = true,
  className = "",
  ariaLabel,
}: BatteryIndicatorProps) {
  const { percent, charging, unknown, refresh } = useBattery();

  const t: BatteryLabels = { ...LABELS[lang], ...labels };
  const text = unknown || percent === null ? "—%" : `${percent}%`;

  const tone =
    unknown || percent === null
      ? "opacity-70"
      : percent < 20
        ? "text-red-500"
        : percent < 40
          ? "text-amber-500"
          : "text-green-500";

  const title = unknown
    ? `${t.battery}: ${t.unknown}`
    : charging
      ? `${t.battery}: ${percent}% · ${t.charging}`
      : `${t.battery}: ${percent}%`;

  const position = standalone
    ? "fixed bottom-4 right-4 z-50"
    : "inline-flex";

  return (
    <button
      type="button"
      onClick={() => void refresh()}
      title={title}
      aria-label={ariaLabel ?? title}
      className={`${position} flex items-center gap-1.5 rounded-full border border-black/10 bg-black/60 px-2.5 py-1 font-mono text-xs text-white shadow-lg backdrop-blur transition hover:bg-black/75 ${tone} ${className}`}
    >
      <BatteryIcon percent={percent} />
      <span className="tabular-nums">{text}</span>
      {charging && (
        <span className="text-green-400" title={t.charging}>
          <PlugIcon />
        </span>
      )}
      {!compact && !unknown && (
        <span className="hidden font-sans sm:inline">{t.battery}</span>
      )}
      {!compact && unknown && (
        <span className="hidden font-sans sm:inline">{t.unknown}</span>
      )}
    </button>
  );
}

export default BatteryIndicator;
