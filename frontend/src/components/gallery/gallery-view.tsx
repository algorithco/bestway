"use client";

import * as React from "react";
import { Image as ImageIcon, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/app/page-header";
import AccordionGallery from "@/components/ui/accordion-gallery";
import { GalleryFormDialog } from "@/components/gallery/gallery-form-dialog";
import { useDeleteGallery, useGalleryAdmin } from "@/hooks/use-gallery";
import type { GalleryAdminItem } from "@/lib/types";

export function GalleryView() {
  const t = useTranslations("gallery");
  const tc = useTranslations("common");
  const { data, isLoading, isError, refetch } = useGalleryAdmin();
  const del = useDeleteGallery();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editItem, setEditItem] = React.useState<GalleryAdminItem | null>(null);

  const items = data ?? [];

  function onDelete(item: GalleryAdminItem) {
    const msg = (t("deleteConfirm") as string) || "Delete this image?";
    if (!confirm(msg)) return;
    del.mutate(item.id, {
      onSuccess: () => toast.success((t("deleted") as string) || "Deleted"),
      onError: () => toast.error(tc("unknownError") as string),
    });
  }

  // Preview items for AccordionGallery (only active, sorted)
  const previewItems = React.useMemo(() => {
    if (items.length === 0) return undefined;
    const active = items.filter((i) => i.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
    if (active.length === 0) return [];
    return active.map((i) => ({ image: i.image, label: i.label, link: i.link, alt: i.alt }));
  }, [items]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={t("title")}
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus />
            {t("create")}
          </Button>
        }
      />
      {/* Preview */}
      {previewItems !== undefined && previewItems.length > 0 && (
        <Card className="p-4">
          <p className="mb-3 text-sm font-medium text-fg-muted">{t("preview")}</p>
          <AccordionGallery items={previewItems} height={380} defaultIndex={1} />
        </Card>
      )}

      {isError ? (
        <ErrorState
          title={tc("error") as string}
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {tc("retry")}
            </Button>
          }
        />
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={ImageIcon} title={t("empty") as string} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card key={item.id} className="group flex flex-col overflow-hidden p-0">
              <div className="relative aspect-[4/3] overflow-hidden bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image}
                  alt={item.alt || item.label || ""}
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute left-2 top-2 flex gap-1">
                  <Badge variant={item.isActive ? "success" : "neutral"}>{item.isActive ? tc("yes") : tc("no")}</Badge>
                  <Badge variant="neutral">#{item.sortOrder}</Badge>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="line-clamp-1 font-semibold text-fg">{item.label || <span className="text-fg-muted">—</span>}</p>
                {item.link && (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 line-clamp-1 text-xs text-brand hover:underline"
                  >
                    {item.link}
                  </a>
                )}
                {item.alt && <p className="mt-1 line-clamp-1 text-xs text-fg-muted">{item.alt}</p>}
                <div className="mt-3 flex gap-1">
                  <Button variant="ghost" size="sm" className="flex-1" onClick={() => setEditItem(item)}>
                    <Pencil className="size-3.5" />
                    {t("edit")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={tc("delete") as string}
                    onClick={() => onDelete(item)}
                  >
                    <Trash2 className="text-danger" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <GalleryFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <GalleryFormDialog open={!!editItem} onClose={() => setEditItem(null)} item={editItem} />
    </div>
  );
}
