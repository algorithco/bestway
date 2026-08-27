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
import { useCreateArticle, useUpdateArticle } from "@/hooks/use-articles";
import { ApiError } from "@/lib/api-client";
import type { Article } from "@/lib/types";

export function ArticleFormDialog({
  open,
  onClose,
  article,
}: {
  open: boolean;
  onClose: () => void;
  article?: Article | null;
}) {
  const t = useTranslations("articles");
  const isEdit = !!article;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        {open && (
          <ArticleFormFields
            key={article?.id ?? "new"}
            article={article}
            onClose={onClose}
            title={isEdit ? t("edit") : t("create")}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ArticleFormFields({
  article,
  onClose,
  title,
}: {
  article?: Article | null;
  onClose: () => void;
  title: string;
}) {
  const t = useTranslations("articles");
  const tc = useTranslations("common");
  const isEdit = !!article;
  const create = useCreateArticle();
  const update = useUpdateArticle(article?.id ?? "");
  const pending = create.isPending || update.isPending;

  const [titleValue, setTitle] = React.useState(article?.title ?? "");
  const [body, setBody] = React.useState(article?.body ?? "");
  const [category, setCategory] = React.useState(article?.category ?? "");
  const [tags, setTags] = React.useState(article?.tags?.join(", ") ?? "");
  const [error, setError] = React.useState<string | null>(null);

  function submit() {
    setError(null);
    if (
      titleValue.trim().length < 3 ||
      body.trim().length < 10 ||
      category.trim().length < 2
    ) {
      setError(tc("unknownError"));
      return;
    }
    const input = {
      title: titleValue.trim(),
      body: body.trim(),
      category: category.trim(),
      tags: tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    const handlers = {
      onSuccess: () => {
        toast.success(isEdit ? t("updated") : t("created"));
        onClose();
      },
      onError: (e: unknown) =>
        setError(e instanceof ApiError ? e.message : tc("unknownError")),
    };
    if (isEdit) update.mutate(input, handlers);
    else create.mutate(input, handlers);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <DialogBody className="space-y-4">
        {error && (
          <div className="rounded-[8px] border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
        <Field label={t("articleTitle")} htmlFor="atitle">
          <Input id="atitle" value={titleValue} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("category")} htmlFor="acat">
            <Input
              id="acat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={t("categoryPlaceholder")}
            />
          </Field>
          <Field label={t("tags")} htmlFor="atags">
            <Input id="atags" value={tags} onChange={(e) => setTags(e.target.value)} />
          </Field>
        </div>
        <Field label={t("body")} htmlFor="abody">
          <Textarea
            id="abody"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-40"
          />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {tc("cancel")}
        </Button>
        <Button onClick={submit} loading={pending}>
          {tc("save")}
        </Button>
      </DialogFooter>
    </>
  );
}
