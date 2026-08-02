"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateMockExam } from "@/hooks/use-mock";
import { ApiError } from "@/lib/api-client";
import type { MockExamType } from "@/lib/types";

const TYPES: MockExamType[] = ["ielts_academic", "ielts_general", "multilevel"];

export function MockExamCreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("mock");
  const tc = useTranslations("common");
  const router = useRouter();
  const create = useCreateMockExam();

  const [type, setType] = React.useState<MockExamType>("ielts_academic");
  const [title, setTitle] = React.useState("");
  const [level, setLevel] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setType("ielts_academic");
      setTitle("");
      setLevel("");
      setPrice("");
      setError(null);
    }
  }, [open]);

  function submit() {
    setError(null);
    if (title.trim().length < 3) return setError(tc("unknownError"));
    create.mutate(
      {
        type,
        title: title.trim(),
        level: level.trim() || undefined,
        price: price ? Number(price) : undefined,
      },
      {
        onSuccess: (exam) => {
          toast.success(tc("saved"));
          onClose();
          router.push(`/mock/${exam.id}`);
        },
        onError: (e) => setError(e instanceof ApiError ? e.message : tc("unknownError")),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("create")}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {error && (
            <div className="rounded-[8px] border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}

          <Field label={tc("name")} htmlFor="mtitle">
            <Input
              id="mtitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="IELTS Academic Mock #1"
              autoFocus
            />
          </Field>

          <Field label="Type">
            <Select value={type} onValueChange={(v) => setType(v as MockExamType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((ty) => (
                  <SelectItem key={ty} value={ty}>
                    {t(`types.${ty}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("cefrLevel")} htmlFor="mlevel">
              <Input
                id="mlevel"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder="Academic / B1-B2"
              />
            </Field>
            <Field label={`${tc("sum")}`} htmlFor="mprice">
              <Input
                id="mprice"
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
              />
            </Field>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            {tc("add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
