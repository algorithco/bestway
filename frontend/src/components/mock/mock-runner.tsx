"use client";

import * as React from "react";
import { AlertTriangle, Loader2, Mic, Send, Square } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import {
  useAdvanceMockSection,
  useBulkMockAnswers,
  useFlagMockCheat,
  useMockExam,
  useSubmitMock,
  useUploadMockSpeaking,
} from "@/hooks/use-mock";
import type {
  MockAttemptDetail,
  MockExamDetail,
  MockQuestion,
  MockQuestionType,
  MockSection,
  MockSkill,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { ListeningAudio } from "@/components/mock/listening-engine";

const SINGLE_CHOICE = new Set<MockQuestionType>([
  "multiple_choice",
  "true_false_notgiven",
  "yes_no_notgiven",
  "matching",
  "matching_headings",
]);
const ESSAY = new Set<MockQuestionType>(["essay_task1", "essay_task2"]);

const STOP_RECORDINGS_EVENT = "mock-stop-recordings";

/** Media backend proxy orqali oqadi — token httpOnly cookie'da */
const media = (path: string) => `/api/backend${path}`;

function optionsFor(q: MockQuestion): string[] {
  if (q.options && q.options.length) return q.options;
  if (q.type === "true_false_notgiven") return ["TRUE", "FALSE", "NOT GIVEN"];
  if (q.type === "yes_no_notgiven") return ["YES", "NO", "NOT GIVEN"];
  return [];
}

function countAnswered(exam: MockExamDetail, answers: Record<string, string>, audio: Set<string>): number {
  let n = 0;
  for (const s of exam.sections)
    for (const g of s.groups)
      for (const q of g.questions) {
        if (q.type === "speaking_task") {
          if (audio.has(q.id)) n++;
        } else if ((answers[q.id] ?? "").trim()) n++;
      }
  return n;
}

export function MockRunner({ attempt }: { attempt: MockAttemptDetail }) {
  const t = useTranslations("mock");
  const tc = useTranslations("common");
  const examQ = useMockExam(attempt.examId);
  const exam = examQ.data;

  const bulk = useBulkMockAnswers(attempt.id);
  const submit = useSubmitMock(attempt.id);
  const flag = useFlagMockCheat(attempt.id);
  const advance = useAdvanceMockSection(attempt.id);

  // Timed = exam-strict playback (full_test ham, single_skill ham).
  // Eslatma: `strict` clipboard/contextmenu bloklashni ham yoqadi — Timed
  // Reading/Writing single_skill da ham ataylab bloklanadi (exam sharti, izchil).
  const isFullTest = (attempt.flowMode ?? "single_skill") === "full_test";
  const strict = attempt.mode === "timed";

  // Boshlang'ich javoblar + speaking audio holati (attempt'dan)
  const initial = React.useMemo(() => {
    const ans: Record<string, string> = {};
    const audio = new Set<string>();
    for (const s of attempt.sections)
      for (const g of s.groups)
        for (const q of g.questions) {
          ans[q.id] = q.response ?? "";
          if (q.hasAudio) audio.add(q.id);
        }
    return { ans, audio };
  }, [attempt]);

  const [answers, setAnswers] = React.useState<Record<string, string>>(initial.ans);
  const [audioSet] = React.useState<Set<string>>(initial.audio);
  const [activeSection, setActiveSection] = React.useState(0);
  const [cheatWarn, setCheatWarn] = React.useState(false);
  const [cheatCount, setCheatCount] = React.useState(0);

  // Full-test: faol bo'lim server'dan (currentSkill) — orqaga qaytish yo'q.
  const skillOrder: MockSkill[] = React.useMemo(() => ["listening", "reading", "writing", "speaking"], []);
  React.useEffect(() => {
    if (!isFullTest || !attempt.currentSkill) return;
    const idx = skillOrder.indexOf(attempt.currentSkill);
    if (idx >= 0) setActiveSection(idx);
  }, [isFullTest, attempt.currentSkill, skillOrder]);

  const answersRef = React.useRef(answers);
  React.useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  const dirty = React.useRef<Set<string>>(new Set());

  const flush = React.useCallback(() => {
    const ids = [...dirty.current];
    if (!ids.length) return;
    dirty.current.clear();
    bulk.mutate(
      ids.map((id) => ({ questionId: id, response: answersRef.current[id] ?? "" })),
      { onError: () => toast.error(tc("saveFailed")) },
    );
  }, [bulk, tc]);

  // Debounce autosave
  React.useEffect(() => {
    const id = setTimeout(flush, 1500);
    return () => clearTimeout(id);
  }, [answers, flush]);

  function setAnswer(qid: string, val: string) {
    dirty.current.add(qid);
    setAnswers((a) => ({ ...a, [qid]: val }));
  }

  // Timer (faqat vaqtli rejim; full-test da umumiy deadline)
  const deadlineTs = attempt.overallDeadlineAt ?? attempt.deadlineAt;
  const deadline = deadlineTs ? new Date(deadlineTs).getTime() : null;
  const [remaining, setRemaining] = React.useState<number | null>(
    () => (deadline ? deadline - Date.now() : null),
  );
  const submittingRef = React.useRef(false);

  const doSubmit = React.useCallback(
    async (auto = false) => {
      if (submittingRef.current) return;
      if (!auto && !confirm(t("submitConfirm"))) return;
      submittingRef.current = true;
      window.dispatchEvent(new Event(STOP_RECORDINGS_EVENT));
      try {
        const all = Object.entries(answersRef.current)
          .filter(([, v]) => v !== "")
          .map(([questionId, response]) => ({ questionId, response }));
        if (all.length) await bulk.mutateAsync(all);
        await submit.mutateAsync();
        toast.success(t("submitted"));
      } catch (e) {
        submittingRef.current = false;
        toast.error(e instanceof Error ? e.message : tc("unknownError"));
      }
    },
    [bulk, submit, t, tc],
  );

  React.useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => {
      const r = deadline - Date.now();
      setRemaining(r);
      if (r <= 0) {
        clearInterval(id);
        void doSubmit(true);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [deadline, doSubmit]);

  // Full-test: keyingi bo'limga o'tish (flush + advance). Review tugashi ham shu yerga keladi.
  const goNextSection = React.useCallback(async () => {
    flush();
    try {
      await advance.mutateAsync();
      toast.success("Next section");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tc("unknownError"));
    }
  }, [advance, flush, tc]);

  // Listening review tugashi: full_test da keyingi bo'limga, single_skill da
  // bo'lim yagona bo'lgani uchun to'g'ridan-to'g'ri auto-submit (advanceSection
  // faqat full_test'da ishlaydi).
  const onListeningReviewComplete = React.useCallback(() => {
    if (isFullTest) void goNextSection();
    else void doSubmit(true);
  }, [isFullTest, goNextSection, doSubmit]);

  // Anti-cheat: warn-only (qaror #5) — tab/blur ni qayd etadi, imtihonni to'xtatmaydi.
  // Clipboard (copy/cut/paste) + contextmenu + drag ildizda bloklanadi (spec §7).
  React.useEffect(() => {
    if (attempt.mode !== "timed") return;
    function report(event: string) {
      flag.mutate(event);
      setCheatWarn(true);
      setCheatCount((c) => c + 1);
    }
    function onHide() {
      if (document.visibilityState === "hidden") report("tab_switch");
    }
    function onBlur() {
      report("blur");
    }
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("blur", onBlur);
    };
  }, [attempt.mode, flag]);

  function blockClipboard(e: React.ClipboardEvent | React.MouseEvent | React.DragEvent) {
    if (!strict) return;
    e.preventDefault();
  }

  if (examQ.isError) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState title={tc("error")} />
      </div>
    );
  }
  if (examQ.isLoading || !exam) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-14" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const total = exam.questionCount;
  const answered = countAnswered(exam, answers, audioSet);
  const section: MockSection | undefined = exam.sections[activeSection];

  return (
    <div
      className="mx-auto max-w-4xl pb-24"
      onCopy={blockClipboard}
      onCut={blockClipboard}
      onPaste={blockClipboard}
      onContextMenu={blockClipboard}
      onDragStart={blockClipboard}
    >
      {/* Yuqori panel */}
      <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-b-[12px] sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-fg">{exam.title}</p>
            <p className="text-xs text-fg-muted">
              {answered} / {total} {t("answered")}
              {bulk.isPending && <Loader2 className="ml-2 inline size-3 animate-spin" />}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {remaining != null && <Timer ms={remaining} label={t("timeLeft")} />}
            {isFullTest && activeSection < exam.sections.length - 1 ? (
              <Button size="sm" variant="outline" loading={advance.isPending} onClick={() => void goNextSection()}>
                Next section
              </Button>
            ) : null}
            <Button size="sm" loading={submit.isPending} onClick={() => doSubmit(false)}>
              <Send />
              {t("submit")}
            </Button>
          </div>
        </div>
        {cheatWarn && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-warning">
            <AlertTriangle className="size-3.5" />
            {t("tabSwitchWarning")}
            {cheatCount > 1 ? ` (${cheatCount})` : ""} — timer continues.
          </p>
        )}
      </div>

      {/* Bo'lim tablari (full-test da faqat status — bosib bo'lmaydi) */}
      {exam.sections.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {exam.sections.map((s, i) => {
            const locked = isFullTest && attempt.currentSkill
              ? s.skill !== attempt.currentSkill
              : false;
            return (
              <button
                key={s.id}
                type="button"
                disabled={isFullTest}
                onClick={() => {
                  if (isFullTest) return;
                  flush();
                  setActiveSection(i);
                }}
                aria-current={i === activeSection}
                title={isFullTest && locked ? "Locked — current section only" : undefined}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  i === activeSection
                    ? "bg-brand text-white"
                    : "bg-surface text-fg-muted hover:bg-surface-hover",
                  isFullTest && locked && "opacity-60",
                  isFullTest && "cursor-default",
                )}
              >
                {t(`skills.${s.skill}`)}
              </button>
            );
          })}
        </div>
      )}

      {section && (
        <div className="space-y-4">
          {section.instructions && (
            <p className="text-sm text-fg-muted">{section.instructions}</p>
          )}
          {section.groups.map((g) => (
            <GroupBlock
              key={g.id}
              group={g}
              skill={section.skill}
              strict={strict && section.skill === "listening"}
              attemptId={attempt.id}
              answers={answers}
              audioSet={audioSet}
              onAnswer={setAnswer}
              onReviewComplete={section.skill === "listening" ? onListeningReviewComplete : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Timer({ ms, label }: { ms: number; label: string }) {
  const safe = Math.max(0, ms);
  const total = Math.floor(safe / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const danger = safe < 5 * 60_000;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums",
        danger ? "bg-danger-bg text-danger" : "bg-bg-subtle text-fg",
      )}
      aria-label={label}
    >
      {h > 0 ? `${pad(h)}:` : ""}
      {pad(m)}:{pad(s)}
    </span>
  );
}

function GroupBlock({
  group,
  skill,
  strict,
  attemptId,
  answers,
  audioSet,
  onAnswer,
  onReviewComplete,
}: {
  group: MockSection["groups"][number];
  skill: MockSkill;
  strict: boolean;
  attemptId: string;
  answers: Record<string, string>;
  audioSet: Set<string>;
  onAnswer: (qid: string, val: string) => void;
  onReviewComplete?: () => void;
}) {
  const hasPassage = !!group.passageText;
  const audioSrc = media(`/mock/groups/${group.id}/audio${strict ? `?attemptId=${attemptId}` : ""}`);
  return (
    <Card className="p-4 sm:p-5">
      {group.title && <h3 className="font-semibold text-fg">{group.title}</h3>}
      {group.hasAudio && skill === "listening" ? (
        <ListeningAudio
          src={audioSrc}
          strict={strict}
          onReviewComplete={strict ? onReviewComplete : undefined}
        />
      ) : (
        group.hasAudio && (
          <audio
            controls
            src={audioSrc}
            className="mt-3 w-full"
            preload="none"
          >
            <track kind="captions" />
          </audio>
        )
      )}
      {group.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={media(`/mock/groups/${group.id}/image`)}
          alt=""
          loading="lazy"
          decoding="async"
          className="mt-3 max-h-96 w-full rounded-[8px] border border-border object-contain"
        />
      )}
      {group.instructions && (
        <p className="mt-3 text-sm font-medium text-fg-muted">{group.instructions}</p>
      )}

      <div className={cn("mt-3", hasPassage && "lg:grid lg:grid-cols-2 lg:gap-6")}>
        {hasPassage && (
          <div className="mb-4 max-h-[70vh] overflow-y-auto whitespace-pre-line rounded-[8px] border border-border bg-bg-subtle p-4 text-sm leading-relaxed text-fg lg:mb-0">
            {group.passageText}
          </div>
        )}
        <div className="space-y-4">
          {group.questions.map((q) => (
            <QuestionInput
              key={q.id}
              question={q}
              attemptId={attemptId}
              value={answers[q.id] ?? ""}
              hasAudio={audioSet.has(q.id)}
              onChange={(v) => onAnswer(q.id, v)}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

function QuestionInput({
  question: q,
  attemptId,
  value,
  hasAudio,
  onChange,
}: {
  question: MockQuestion;
  attemptId: string;
  value: string;
  hasAudio: boolean;
  onChange: (v: string) => void;
}) {
  const t = useTranslations("mock");

  const header = (
    <div className="flex items-start gap-2">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-subtle text-xs font-semibold text-brand-subtle-fg tabular-nums">
        {q.number}
      </span>
      <p className="whitespace-pre-line text-sm text-fg">{q.prompt}</p>
    </div>
  );

  if (q.type === "speaking_task") {
    return (
      <div className="space-y-2">
        {header}
        <SpeakingRecorder attemptId={attemptId} questionId={q.id} initialHasAudio={hasAudio} />
      </div>
    );
  }

  if (ESSAY.has(q.type)) {
    const words = value.trim() ? value.trim().split(/\s+/).length : 0;
    // Spec §2.3: Task1 min 150, Task2 min 250 (soft — warning, no hard block).
    const minWords = q.type === "essay_task1" ? 150 : q.type === "essay_task2" ? 250 : (q.wordLimit ?? 0);
    const underMin = minWords > 0 && words > 0 && words < minWords;
    return (
      <div className="space-y-2">
        {header}
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-48"
          placeholder="..."
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          autoComplete="off"
        />
        <p className={cn("text-right text-xs tabular-nums", underMin ? "text-warning" : "text-fg-subtle")}>
          {words} {t("words")}
          {minWords > 0 ? ` · min ${minWords}` : ""}
          {underMin ? ` — minimum ${minWords} words required` : ""}
        </p>
      </div>
    );
  }

  if (SINGLE_CHOICE.has(q.type)) {
    const opts = optionsFor(q);
    return (
      <div className="space-y-2">
        {header}
        <div className="flex flex-wrap gap-2">
          {opts.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              aria-pressed={value === opt}
              className={cn(
                "rounded-[8px] border px-3 py-1.5 text-sm transition-colors",
                value === opt
                  ? "border-brand bg-brand-subtle font-medium text-brand-subtle-fg"
                  : "border-border bg-surface text-fg-muted hover:bg-surface-hover",
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (q.type === "multi_select") {
    const opts = optionsFor(q);
    const selected = value ? value.split(",").map((v) => v.trim()) : [];
    function toggle(opt: string) {
      const next = selected.includes(opt)
        ? selected.filter((v) => v !== opt)
        : [...selected, opt];
      onChange(next.join(","));
    }
    return (
      <div className="space-y-2">
        {header}
        <div className="flex flex-wrap gap-2">
          {opts.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              aria-pressed={selected.includes(opt)}
              className={cn(
                "rounded-[8px] border px-3 py-1.5 text-sm transition-colors",
                selected.includes(opt)
                  ? "border-brand bg-brand-subtle font-medium text-brand-subtle-fg"
                  : "border-border bg-surface text-fg-muted hover:bg-surface-hover",
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // TEXT_INPUT (default)
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-subtle text-xs font-semibold text-brand-subtle-fg tabular-nums">
        {q.number}
      </span>
      <div className="min-w-0 flex-1">
        {q.prompt && <p className="mb-1 whitespace-pre-line text-sm text-fg">{q.prompt}</p>}
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

function SpeakingRecorder({
  attemptId,
  questionId,
  initialHasAudio,
}: {
  attemptId: string;
  questionId: string;
  initialHasAudio: boolean;
}) {
  const t = useTranslations("mock");
  const tc = useTranslations("common");
  const upload = useUploadMockSpeaking(attemptId);
  const [recording, setRecording] = React.useState(false);
  const [hasAudio, setHasAudio] = React.useState(initialHasAudio);
  const recRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunks = React.useRef<Blob[]>([]);

  const halt = React.useCallback(() => {
    const mr = recRef.current;
    if (mr && mr.state === "recording") mr.stop();
    setRecording(false);
  }, []);

  React.useEffect(() => {
    window.addEventListener(STOP_RECORDINGS_EVENT, halt);
    return () => {
      window.removeEventListener(STOP_RECORDINGS_EVENT, halt);
      halt();
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    };
  }, [halt]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chunks.current, { type: mr.mimeType || "audio/webm" });
        const form = new FormData();
        form.append("audio", blob, "speaking.webm");
        upload.mutate(
          { questionId, form },
          {
            onSuccess: () => {
              setHasAudio(true);
              toast.success(tc("saved"));
            },
            onError: () => toast.error(tc("unknownError")),
          },
        );
      };
      recRef.current = mr;
      streamRef.current = stream;
      mr.start();
      setRecording(true);
    } catch {
      toast.error(t("micError"));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[8px] border border-border bg-bg-subtle p-3">
      {recording ? (
        <Button size="sm" variant="danger" onClick={halt}>
          <Square className="fill-current" />
          {t("stopRecording")}
        </Button>
      ) : (
        <Button size="sm" variant="outline" loading={upload.isPending} onClick={start}>
          <Mic />
          {hasAudio ? t("reRecord") : t("record")}
        </Button>
      )}
      {hasAudio && !recording && (
        <audio
          controls
          src={media(`/mock/attempts/${attemptId}/answers/${questionId}/audio`)}
          className="h-9"
          preload="none"
        >
          <track kind="captions" />
        </audio>
      )}
      {recording && (
        <span className="flex items-center gap-1.5 text-sm text-danger">
          <span className="size-2 animate-pulse rounded-full bg-danger" />
          {t("recording")}
        </span>
      )}
    </div>
  );
}
