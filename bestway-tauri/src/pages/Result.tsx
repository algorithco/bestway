type Props = {
  onBack: () => void;
};

export default function Result({ onBack }: Props) {
  return (
    <section>
      <h1 className="text-xl font-semibold">Result</h1>
      <p className="mt-1 text-sm text-slate-500">Submission result. Online-only.</p>
      {/* TODO: load score/submission from backend /v1/tests+mock contract; online-only. */}
      <div className="mt-4 rounded border bg-white p-4">
        <p className="text-sm">No result loaded (stub).</p>
      </div>
      <button
        onClick={onBack}
        className="mt-4 rounded border px-4 py-2"
      >
        Back to exams
      </button>
    </section>
  );
}
