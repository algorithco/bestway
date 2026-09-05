type Props = {
  onBack: () => void;
};

export default function Locked({ onBack }: Props) {
  return (
    <section>
      <h1 className="text-xl font-semibold">Locked</h1>
      <p className="mt-1 text-sm text-slate-500">
        Session locked (e.g. focus/battery policy). Contact supervisor.
      </p>
      {/* TODO: reflect lock state from backend /v1/tests+mock contract session status; online-only. */}
      <button
        onClick={onBack}
        className="mt-4 rounded border px-4 py-2"
      >
        Back to exams
      </button>
    </section>
  );
}
