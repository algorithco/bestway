type Props = {
  onLocked: () => void;
  onFinish: () => void;
};

export default function Runner({ onLocked, onFinish }: Props) {
  return (
    <section>
      <h1 className="text-xl font-bold tracking-tight">Runner</h1>
      <p className="mt-1 text-sm text-white/50">
        Question-by-question runner. Online-only.
      </p>
      {/* TODO: fetch questions + submit answers via backend /v1/tests+mock contract; online-only, no local persistence. */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={onLocked}
          className="btn-ghost rounded-xl px-4 py-2 text-sm text-white"
        >
          Simulate lock
        </button>
        <button
          onClick={onFinish}
          className="btn-brand rounded-xl px-4 py-2 text-sm font-semibold"
        >
          Finish (stub)
        </button>
      </div>
    </section>
  );
}
