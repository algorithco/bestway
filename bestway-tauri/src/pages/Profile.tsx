import VolumeControl from "@/components/VolumeControl";

type Props = {
  name: string | null;
  phone: string | null;
  onLogout: () => void;
  stats?: { attempts: number; completed: number; avgScore: number | null } | null;
};

function LogoutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

/** Student profile: identity card, quick stats, audio volume, sign out. */
export default function Profile({ name, phone, onLogout, stats }: Props) {
  const display = name ?? "Student";
  const initial = display.trim().charAt(0).toUpperCase() || "?";
  return (
    <section>
      <h1 className="text-xl font-bold tracking-tight">Profile</h1>
      <p className="mt-1 text-sm text-white/50">Your account and app preferences.</p>

      <div className="mt-4 grid items-start gap-3 xl:grid-cols-2">
        <div className="card relative overflow-hidden rounded-2xl p-5">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-400/15 blur-2xl" />
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-2xl font-black text-black shadow-[0_0_32px_rgba(56,199,101,0.45)]">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-white">{display}</p>
              {phone && <p className="mt-0.5 font-mono text-xs text-white/50">{phone}</p>}
              <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-200 ring-1 ring-emerald-400/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                student
              </span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-black/30 p-3 text-center ring-1 ring-white/10">
              <p className="text-xl font-black text-white">{stats?.attempts ?? "—"}</p>
              <p className="mt-0.5 text-[11px] uppercase tracking-widest text-white/40">attempts</p>
            </div>
            <div className="rounded-2xl bg-black/30 p-3 text-center ring-1 ring-white/10">
              <p className="text-xl font-black text-white">{stats?.completed ?? "—"}</p>
              <p className="mt-0.5 text-[11px] uppercase tracking-widest text-white/40">graded</p>
            </div>
            <div className="rounded-2xl bg-black/30 p-3 text-center ring-1 ring-white/10">
              <p className="text-xl font-black text-emerald-300">
                {stats?.avgScore == null ? "—" : Math.round(stats.avgScore * 10) / 10}
              </p>
              <p className="mt-0.5 text-[11px] uppercase tracking-widest text-white/40">avg score</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-white/30">
            Detailed stats load when you open History.
          </p>
        </div>

        <div className="space-y-3">
          <VolumeControl label="Listening volume" />
          <div className="card rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white">Session</h2>
            <button
              type="button"
              onClick={onLogout}
              className="btn-ghost mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-red-300 hover:text-red-200"
            >
              <LogoutIcon />
              Log out
            </button>
            <p className="mt-2 text-[11px] text-white/30">
              Logging out clears tokens on this device only.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
