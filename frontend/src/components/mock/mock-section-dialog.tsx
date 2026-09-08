"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateMockSection } from "@/hooks/use-mock";
import { ApiError } from "@/lib/api-client";
import type { MockSkill } from "@/lib/types";

const ALL_SKILLS: MockSkill[] = ["listening", "reading", "writing", "speaking"];

export function MockSectionDialog({
  examId,
  existing,
  open,
  onClose,
}: {
  examId: string;
  existing: MockSkill[];
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("mock");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addSection")}</DialogTitle>
        </DialogHeader>
        {open && <MockSectionFields key={existing.join(",")} examId={examId} existing={existing} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function MockSectionFields({
  examId,
  existing,
  onClose,
}: {
  examId: string;
  existing: MockSkill[];
  onClose: () => void;
}) {
  const t = useTranslations("mock");
  const tc = useTranslations("common");
  const create = useCreateMockSection(examId);
  const available = ALL_SKILLS.filter((s) => !existing.includes(s));

  const [skill, setSkill] = React.useState<MockSkill>(available[0] ?? "listening");
  const [duration, setDuration] = React.useState("");
  const [instructions, setInstructions] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  // Listening timing is never driven by durationMinutes (see
  // backend computeSkillTiming: audio sum + 120s review) — the field below
  // is informational/disabled for listening so authors aren't misled.
  const isListening = skill === "listening";

  function submit() {
    setError(null);
    create.mutate(
      {
        skill,
        durationMinutes: isListening ? undefined : duration ? Number(duration) : undefined,
        instructions: instructions.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(tc("saved"));
          onClose();
        },
        onError: (e) => setError(e instanceof ApiError ? e.message : tc("unknownError")),
      },
    );
  }

  return (
    <>
      <DialogBody className="space-y-4">
        {error && (
          <div className="rounded-[8px] border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
        <Field label={t("skill")}>
          <Select value={skill} onValueChange={(v) => setSkill(v as MockSkill)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {available.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`skills.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          label={t("duration")}
          htmlFor="sdur"
          hint={isListening ? t("durationHintListening") : undefined}
        >
          <Input
            id="sdur"
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder={isListening ? "—" : "30"}
            disabled={isListening}
          />
        </Field>
        <Field label={t("instructions")} htmlFor="sinstr">
          <Textarea
            id="sinstr"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className="min-h-20"
          />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {tc("cancel")}
        </Button>
        <Button onClick={submit} loading={create.isPending} disabled={available.length === 0}>
          {tc("add")}
        </Button>
      </DialogFooter>
    </>
  );
}
