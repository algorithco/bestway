"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, BookOpenText, GraduationCap, Languages } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/app/page-header";
import { useCreateMockExam } from "@/hooks/use-mock";
import { ApiError } from "@/lib/api-client";
import type { MockExamType } from "@/lib/types";
import { EXAM_TYPES, EXAM_TYPE_LABEL, tx } from "./types";

const TYPE_ICON: Record<MockExamType, typeof BookOpenText> = {
  ielts_academic: GraduationCap,
  ielts_general: BookOpenText,
  multilevel: Languages,
};

const TYPE_HINT: Record<MockExamType, string> = {
  ielts_academic: "Full academic format · bands 0–9",
  ielts_general: "General training format · bands 0–9",
  multilevel: "Level placement · CEFR result (A1–C1)",
};

/**
 * Step 1 of the unified flow: clean exam setup.
 * Creates the exam shell (always a DRAFT) and jumps straight into the builder.
 */
export function ExamSetup() {
  const t = useTranslations("examBuilder");
  const tc = useTranslations("common");
  const router = useRouter();
  const create = useCreateMockExam();

  const [type, setType] = React.useState<MockExamType>("ielts_academic");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [level, setLevel] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [isFreeForApproved, setIsFreeForApproved] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  function submit() {
    setError(null);
    if (title.trim().length < 3) {
      setError(tx(t, "titleTooShort", "Title must be at least 3 characters."));
      return;
    }
    const priceNum = price === "" ? 0 : Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setError(tx(t, "priceInvalid", "Price must be 0 or more."));
      return;
    }
    create.mutate(
      {
        type,
        title: title.trim(),
        description: description.trim() || undefined,
        level: level.trim() || undefined,
        price: priceNum,
        isFreeForApproved,
      },
      {
        onSuccess: (exam) => {
          toast.success(tx(t, "created", "Exam created — now build the content."));
          router.push(`/exam-builder/${exam.id}`);
        },
        onError: (e) => setError(e instanceof ApiError ? e.message : tc("unknownError")),
      },
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title={tx(t, "setupTitle", "Create Exam")}
        description={tx(
          t,
          "setupHint",
          "Start with the basics. The exam is saved as a draft — you publish it when the content is ready.",
        )}
      />

      {error && (
        <div className="mb-4 rounded-[8px] border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{tx(t, "examType", "Exam type")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Exam type">
            {EXAM_TYPES.map((ty) => {
              const Icon = TYPE_ICON[ty];
              const active = type === ty;
              return (
                <button
                  key={ty}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setType(ty)}
                  className={`rounded-[10px] border p-3 text-left transition ${
                    active
                      ? "border-brand bg-brand-subtle"
                      : "border-border bg-surface hover:border-fg-subtle"
                  }`}
                >
                  <Icon className={`size-5 ${active ? "text-brand" : "text-fg-muted"}`} />
                  <p className="mt-1.5 text-sm font-semibold text-fg">{EXAM_TYPE_LABEL[ty]}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-fg-muted">{TYPE_HINT[ty]}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{tx(t, "basics", "Basics")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label={tx(t, "title", "Title")} htmlFor="eb-title">
            <Input
              id="eb-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="IELTS Mock 1 — Academic"
              autoFocus
            />
          </Field>
          <Field label={tx(t, "description", "Description")} htmlFor="eb-desc">
            <Textarea
              id="eb-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tx(t, "descriptionHint", "What is this exam for? Shown to students.")}
              className="min-h-20"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={tx(t, "level", "Level")} htmlFor="eb-level">
              <Input
                id="eb-level"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder="Academic / B1–B2"
              />
            </Field>
            <Field label={tx(t, "price", "Price (0 = free)")} htmlFor="eb-price">
              <Input
                id="eb-price"
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
              />
            </Field>
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-[8px] border border-border p-3">
            <input
              type="checkbox"
              checked={isFreeForApproved}
              onChange={(e) => setIsFreeForApproved(e.target.checked)}
              className="mt-0.5 accent-[var(--color-brand,#38c765)]"
            />
            <span>
              <span className="block text-sm font-medium text-fg">
                {tx(t, "freeApproved", "Free for enrolled students")}
              </span>
              <span className="block text-xs text-fg-muted">
                {tx(t, "freeApprovedHint", "Approved students open it without payment. Others request access manually.")}
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center justify-between gap-2">
        <Link href="/exam-builder">
          <Button variant="outline">
            <ArrowLeft className="size-4" />
            {tc("cancel")}
          </Button>
        </Link>
        <Button onClick={submit} loading={create.isPending}>
          {tx(t, "createContinue", "Create & Continue")}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
