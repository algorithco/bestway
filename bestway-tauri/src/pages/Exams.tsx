type Props = {
  onStart: () => void;
};

export default function Exams({ onStart }: Props) {
  return (
    <section>
      <h1 className="text-xl font-bold tracking-tight">Exams</h1>
      <p className="mt-1 text-sm text-white/50">
        Assigned exams for the signed-in student. Online-only.
      </p>
      {/* TODO: fetch from backend GET /v1/tests+mock contract (list assigned tests); online-only. */}
      <div className="card mt-4 rounded-2xl p-5">
        <p className="text-sm text-white/60">No exams loaded (stub).</p>
        <button
          onClick={onStart}
          className="btn-brand mt-3 rounded-xl px-4 py-2 text-sm font-semibold"
        >
          Start (stub)
        </button>
      </div>
    </section>
  );
}
