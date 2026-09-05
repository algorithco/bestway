type Props = {
  onLocked: () => void;
  onFinish: () => void;
};

export default function Runner({ onLocked, onFinish }: Props) {
  return (
    <section>
      <h1 className="text-xl font-semibold">Runner</h1>
      <p className="mt-1 text-sm text-slate-500">
        Question-by-question runner. Online-only.
      </p>
      {/* TODO: fetch questions + submit answers via backend /v1/tests+mock contract; online-only, no local persistence. */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={onLocked}
          className="rounded border px-4 py-2"
        >
          Simulate lock
        </button>
        <button
          onClick={onFinish}
          className="rounded bg-blue-700 px-4 py-2 text-white"
        >
          Finish (stub)
        </button>
      </div>
    </section>
  );
}
