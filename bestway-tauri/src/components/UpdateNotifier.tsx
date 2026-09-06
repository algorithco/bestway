import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { openInBrowser } from "@/lib/oauth";
import { dismissVersion, type UpdateInfo } from "@/lib/version";
import { isSafeHttpUrl } from "@/lib/secure-storage";

type Props = {
  update: UpdateInfo;
  onClose: () => void;
};

/**
 * Version-update toast, top-right — same structure as the reference
 * Announcement card (leading icon, dismiss, title, description, full-width
 * secondary CTA), restyled to the app's dark + emerald identity.
 *
 * Dismissal plays a soft blur + scale-down exit via motion, persists the
 * dismissed version (same version never nags twice), then unmounts.
 */
export default function UpdateNotifier({ update, onClose }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [opening, setOpening] = useState(false);

  const close = () => {
    dismissVersion(update.latest);
    setDismissed(true);
  };

  const handleAction = async () => {
    if (!update.downloadUrl || opening) return;
    if (!isSafeHttpUrl(update.downloadUrl)) return;
    setOpening(true);
    try {
      await openInBrowser(update.downloadUrl);
    } catch {
      /* opener already fell back to a tab; nothing more to do */
    } finally {
      setOpening(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="Application update available"
      className="pointer-events-none fixed right-4 top-4 z-[70] w-[320px] max-w-[calc(100vw-2rem)]"
    >
      <AnimatePresence onExitComplete={onClose}>
        {!dismissed && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.95, filter: "blur(6px)" }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              filter: "blur(0px)",
              transition: { duration: 0.25, ease: "easeOut", delay: 0.35 },
            }}
            exit={{
              opacity: 0,
              scale: 0.85,
              filter: "blur(6px)",
              transition: { duration: 0.25, ease: "easeInOut" },
            }}
            className="card pointer-events-auto relative flex w-full flex-col items-start gap-3 rounded-xl border-white/10 bg-black/70 p-3 shadow-[0_16px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          >
            <div className="flex w-full flex-col items-start gap-1">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/25">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="m7 10 5 5 5-5" />
                  <path d="M12 15V3" />
                </svg>
              </span>

              <button
                type="button"
                aria-label="Dismiss update notification"
                onClick={close}
                className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-md text-white/40 transition hover:bg-white/5 hover:text-white"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>

              <div className="flex w-full flex-col items-start">
                <p className="w-full text-sm font-semibold text-white">New version available</p>
                <p className="mt-0.5 w-full text-[13px] leading-snug text-white/55">
                  Bestway Exam {update.latest} is ready — you&apos;re on {update.current}.
                </p>
              </div>
            </div>

            {update.downloadUrl && (
              <button
                type="button"
                onClick={() => void handleAction()}
                disabled={opening}
                className="btn-ghost w-full rounded-lg px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
              >
                {opening ? "Opening…" : "Update now"}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
