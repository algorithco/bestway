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
import { useCreateGallery, useUpdateGallery } from "@/hooks/use-gallery";
import { ApiError } from "@/lib/api-client";
import type { GalleryAdminItem } from "@/lib/types";

export function GalleryFormDialog({
  open,
  onClose,
  item,
}: {
  open: boolean;
  onClose: () => void;
  item?: GalleryAdminItem | null;
}) {
  const isEdit = !!item;
  const tGallery = useTranslations("gallery");
  // fallback to common if gallery namespace missing
  const tCommon = useTranslations("common");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        {open && (
          <GalleryFormFields
            key={item?.id ?? "new"}
            item={item}
            onClose={onClose}
            title={isEdit ? tGallery("edit") : tGallery("create")}
            tGallery={tGallery}
            tCommon={tCommon}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function GalleryFormFields({
  item,
  onClose,
  title,
  tGallery,
  tCommon,
}: {
  item?: GalleryAdminItem | null;
  onClose: () => void;
  title: string;
  tGallery: ReturnType<typeof useTranslations>;
  tCommon: ReturnType<typeof useTranslations>;
}) {
  const isEdit = !!item;
  const create = useCreateGallery();
  const update = useUpdateGallery(item?.id ?? "");
  const pending = create.isPending || update.isPending;

  const [label, setLabel] = React.useState(item?.label ?? "");
  const [link, setLink] = React.useState(item?.link ?? "");
  const [alt, setAlt] = React.useState(item?.alt ?? "");
  const [sortOrder, setSortOrder] = React.useState(String(item?.sortOrder ?? 0));
  const [isActive, setIsActive] = React.useState(item?.isActive ?? true);
  const [file, setFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function submit() {
    setError(null);
    if (!isEdit && !file) {
      setError(tGallery("imageRequired") ?? "Image is required");
      return;
    }
    if (label.trim().length > 120) {
      setError("Label too long");
      return;
    }
    const form = new FormData();
    if (label.trim()) form.set("label", label.trim());
    if (link.trim()) form.set("link", link.trim());
    if (alt.trim()) form.set("alt", alt.trim());
    form.set("sortOrder", String(Number(sortOrder) || 0));
    form.set("isActive", String(isActive));
    if (file) form.set("image", file);

    const handlers = {
      onSuccess: () => {
        toast.success(isEdit ? (tGallery("updated") as string) : (tGallery("created") as string));
        onClose();
      },
      onError: (e: unknown) => setError(e instanceof ApiError ? e.message : (tCommon("unknownError") as string)),
    };
    if (isEdit) update.mutate(form, handlers);
    else create.mutate(form, handlers);
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
        {isEdit && item?.image && !file && (
          <div className="overflow-hidden rounded-[10px] border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.image} alt={item.alt || item.label || ""} loading="lazy" decoding="async" className="max-h-48 w-full object-cover" />
          </div>
        )}
        <Field label={tGallery("image")} htmlFor="gimage">
          <Input
            id="gimage"
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <p className="mt-1 text-xs text-fg-muted">{tGallery("imageHint")}</p>
        </Field>
        <Field label={tGallery("label")} htmlFor="glabel">
          <Input
            id="glabel"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={tGallery("labelPlaceholder")}
            maxLength={120}
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={tGallery("link")} htmlFor="glink">
            <Input
              id="glink"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://..."
              maxLength={500}
            />
          </Field>
          <Field label={tGallery("alt")} htmlFor="galt">
            <Input id="galt" value={alt} onChange={(e) => setAlt(e.target.value)} placeholder={tGallery("altPlaceholder")} maxLength={300} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={tGallery("sortOrder")} htmlFor="gsort">
            <Input
              id="gsort"
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </Field>
          <Field label={tGallery("isActive")} htmlFor="gactive">
            <label className="flex items-center gap-2 pt-1">
              <input
                id="gactive"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="size-4 rounded border-border"
              />
              <span className="text-sm text-fg">{isActive ? tCommon("yes") : tCommon("no")}</span>
            </label>
          </Field>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {tCommon("cancel")}
        </Button>
        <Button onClick={submit} loading={pending}>
          {tCommon("save")}
        </Button>
      </DialogFooter>
    </>
  );
}
