type Props = {
  onBack: () => void;
};

export default function Result({ onBack }: Props) {
  return (
    <section>
      <h1 className="text-xl font-bold tracking-tight">Result</h1>
      <p className="mt-1 text-sm text-white/50">Submission result. Online-only.</p>
      {/* TODO: load score/submission from backend /v1/tests+mock contract; online-only. */}
      <div className="card mt-4 rounded-2xl p-5">
        <p className="text-sm text-white/60">No result loaded (stub).</p>
      </div>
      <button
        onClick={onBack}
        className="btn-ghost mt-4 rounded-xl px-4 py-2 text-sm text-white"
      >
        Back to exams
      </button>
    </section>
  );
}
