"use client";

import * as React from "react";
import { Play, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const REVIEW_SEC = 120;

function fmt(totalSec: number): string {
  const s = Math.max(0, Math.ceil(totalSec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Listening audio engine — spec §2.1.
 * strict (exam full_test): play ONCE, no pause/rewind/ff, volume only.
 * After audio ends → 2:00 review countdown → onReviewComplete (auto-advance).
 * practice: native controls, unlimited replay.
 */
export function ListeningAudio({
  src,
  strict,
  onEnded,
  onReviewComplete,
}: {
  src: string;
  strict: boolean;
  onEnded?: () => void;
  onReviewComplete?: () => void;
}) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [started, setStarted] = React.useState(false);
  const [ended, setEnded] = React.useState(false);
  const [reviewLeft, setReviewLeft] = React.useState<number | null>(null);
  const doneRef = React.useRef(false);

  // Review countdown (exactly 2 minutes, spec §2.1)
  React.useEffect(() => {
    if (reviewLeft == null) return;
    if (reviewLeft <= 0) {
      if (!doneRef.current) {
        doneRef.current = true;
        onReviewComplete?.();
      }
      return;
    }
    const id = setTimeout(() => setReviewLeft((v) => (v == null ? v : v - 1)), 1000);
    return () => clearTimeout(id);
  }, [reviewLeft, onReviewComplete]);

  function handleEnded() {
    setEnded(true);
    onEnded?.();
    // Practice da review yo'q — faqat exam da auto-advance uchun.
    if (strict) setReviewLeft(REVIEW_SEC);
  }

  if (!strict) {
    return (
      <audio
        controls
        src={src}
        className="mt-3 w-full"
        preload="none"
        onEnded={handleEnded}
      >
        <track kind="captions" />
      </audio>
    );
  }

  async function playOnce() {
    const el = audioRef.current;
    if (!el || started) return;
    setStarted(true);
    try {
      await el.play();
    } catch {
      setStarted(false);
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-[8px] border border-border bg-bg-subtle p-3">
      {/* Hidden audio: no native controls → no pause/seek UI. Volume via control below. */}
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        controlsList="nodownload noplaybackrate"
        onEnded={handleEnded}
        onContextMenu={(e) => e.preventDefault()}
      >
        <track kind="captions" />
      </audio>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={playOnce} disabled={started}>
          <Play />
          {started ? (ended ? "Played once" : "Playing… (once only)") : "Play audio (once only)"}
        </Button>
        <label className="flex items-center gap-2 text-sm text-fg-muted">
          <Volume2 className="size-4" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            defaultValue={1}
            aria-label="Volume"
            className="h-1 w-28 accent-current"
            onChange={(e) => {
              if (audioRef.current) audioRef.current.volume = Number(e.target.value);
            }}
          />
        </label>
        {reviewLeft != null && reviewLeft > 0 && (
          <span className="ml-auto text-sm font-semibold tabular-nums" aria-live="polite">
            Review: {fmt(reviewLeft)}
          </span>
        )}
        {reviewLeft === 0 && (
          <span className="ml-auto text-sm font-semibold text-warning">
            Review over — moving on…
          </span>
        )}
      </div>
      {!started && (
        <p className="text-xs text-fg-muted">
          Exam mode: audio plays once, no pause / rewind / fast-forward.
        </p>
      )}
    </div>
  );
}
