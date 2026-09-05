type Props = {
  onStart: () => void;
};

export default function Exams({ onStart }: Props) {
  return (
    <section>
      <h1 className="text-xl font-semibold">Exams</h1>
      <p className="mt-1 text-sm text-slate-500">
        Assigned exams for the signed-in student. Online-only.
      </p>
      {/* TODO: fetch from backend GET /v1/tests+mock contract (list assigned tests); online-only. */}
      <div className="mt-4 rounded border bg-white p-4">
        <p className="text-sm">No exams loaded (stub).</p>
        <button
          onClick={onStart}
          className="mt-3 rounded bg-blue-700 px-4 py-2 text-white"
        >
          Start (stub)
        </button>
      </div>
    </section>
  );
}
