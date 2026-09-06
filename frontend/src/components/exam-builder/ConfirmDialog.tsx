"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { tx } from "./types";

/**
 * Deliberate destructive confirmation: names what will be deleted and its
 * cascading consequences. Plain text only — callers must pass truthful
 * copy that matches backend behavior (no vague "Are you sure?").
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  loading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("examBuilder");
  const tc = useTranslations("common");
  if (!open) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="size-5 shrink-0 text-danger" aria-hidden />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <p className="text-xs text-fg-muted">
            {tx(t, "undoHint", "This action cannot be undone.")}
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {tx(t, "keepEditing", "Keep editing")}
          </Button>
          <Button variant="danger" loading={loading} onClick={onConfirm}>
            {confirmLabel || tc("delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
