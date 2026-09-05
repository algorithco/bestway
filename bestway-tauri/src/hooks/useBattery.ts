import { useCallback, useEffect, useRef, useState } from "react";

export interface BatterySnapshot {
  /** 0–100, or null when unknown */
  percent: number | null;
  charging: boolean;
  /** Raw backend state string when available (e.g. "Charging" / "Discharging") */
  state: string | null;
  unknown: boolean;
}

export interface UseBatteryResult extends BatterySnapshot {
  /** Re-run the full detection chain on demand. */
  refresh: () => Promise<void>;
}

/** Tauri `get_battery` command payload. */
interface TauriBatteryPayload {
  percent?: number;
  charging?: boolean;
  state?: string | null;
}

/** Minimal shape of the Browser Battery Status API (not in all TS libs). */
interface BrowserBatteryManager extends EventTarget {
  level: number;
  charging: boolean;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<BrowserBatteryManager>;
}

function clampPercent(v: unknown): number | null {
  if (typeof v !== "number" || Number.isNaN(v)) return null;
  if (v <= 1 && v > 0 && v < 1.1) {
    // Some backends may return 0..1 ratio — normalize defensively.
    // Distinguish true 0%/1% from ratio: only treat fractional values as ratio.
    if (!Number.isInteger(v)) return Math.round(v * 100);
  }
  const n = Math.round(v);
  if (n < 0 || n > 100) return null;
  return n;
}

async function tryTauriBattery(): Promise<BatterySnapshot | null> {
  try {
    // Dynamic import => no hard dependency when running as plain web app.
    const mod = await import("@tauri-apps/api/core").catch(() => null);
    const invoke = (mod as { invoke?: unknown } | null)?.invoke;
    if (typeof invoke !== "function") return null;
    const raw = await (invoke as (cmd: string) => Promise<unknown>)(
      "get_battery",
    );
    if (!raw || typeof raw !== "object") return null;
    const payload = raw as TauriBatteryPayload;
    const percent = clampPercent(payload.percent);
    const charging =
      typeof payload.charging === "boolean"
        ? payload.charging
        : typeof payload.state === "string"
          ? payload.state.toLowerCase().includes("charg")
          : false;
    if (percent === null) return null;
    return {
      percent,
      charging,
      state:
        typeof payload.state === "string" && payload.state.length > 0
          ? payload.state
          : charging
            ? "Charging"
            : "Discharging",
      unknown: false,
    };
  } catch {
    return null;
  }
}

async function tryBrowserBattery(
  signal?: AbortSignal,
): Promise<BatterySnapshot | null> {
  try {
    const nav = navigator as NavigatorWithBattery;
    if (typeof nav.getBattery !== "function") return null;
    const mgr = await nav.getBattery();
    if (signal?.aborted) return null;
    const percent = clampPercent(mgr.level * 100);
    if (percent === null) return null;
    return {
      percent,
      charging: mgr.charging === true,
      state: mgr.charging ? "Charging" : "Discharging",
      unknown: false,
    };
  } catch {
    return null;
  }
}

const UNKNOWN: BatterySnapshot = {
  percent: null,
  charging: false,
  state: null,
  unknown: true,
};

const POLL_MS = 30_000;

/**
 * Encapsulates battery detection with ordered fallbacks:
 *  1. Tauri `invoke('get_battery')` -> { percent, charging, state }
 *  2. Browser `navigator.getBattery()` fallback
 *  3. Unknown (`percent: null`, `unknown: true`)
 *
 * Polls every 30s and exposes `refresh()` for on-demand reads.
 * Safe on web (no hard `@tauri-apps/api` dependency — dynamic import only).
 */
export function useBattery(pollMs: number = POLL_MS): UseBatteryResult {
  const [snapshot, setSnapshot] = useState<BatterySnapshot>(UNKNOWN);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const controller = new AbortController();
    const fromTauri = await tryTauriBattery();
    if (fromTauri) {
      if (mountedRef.current) setSnapshot({ ...fromTauri, unknown: false });
      return;
    }
    const fromBrowser = await tryBrowserBattery(controller.signal);
    if (mountedRef.current) {
      setSnapshot(fromBrowser ? { ...fromBrowser, unknown: false } : UNKNOWN);
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (pollMs <= 0) return;
    const id = window.setInterval(() => {
      void refresh();
    }, pollMs);
    return () => window.clearInterval(id);
  }, [refresh, pollMs]);

  return { ...snapshot, refresh };
}

export default useBattery;
