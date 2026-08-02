"use client";

import * as React from "react";
import { CheckCircle2, Clock, Lock, Play, PlaySquare, Plus, ShoppingCart, Trash2, Video } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TiltCard } from "@/components/ui/tilt-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/app/page-header";
import { VideoCreateDialog } from "@/components/videos/video-create-dialog";
import {
  useVideos,
  useStreamUrl,
  usePurchaseVideo,
  useVideoPurchases,
  useConfirmPurchase,
  useDeleteVideo,
} from "@/hooks/use-videos";
import { useMe } from "@/hooks/use-me";
import type { VideoLessonItem } from "@/lib/types";
import { formatMoney, formatPhone } from "@/lib/utils";

export function VideosView() {
  const t = useTranslations("videos");
  const tc = useTranslations("common");
  const { data: me } = useMe();
  const role = me?.user.role;
  const isOffice = role === "admin" || role === "super_admin";
  const isStudent = role === "student";

  const [tab, setTab] = React.useState<"videos" | "purchases">("videos");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [playing, setPlaying] = React.useState<{ url: string; title: string } | null>(null);

  const videosQ = useVideos();
  const stream = useStreamUrl();
  const purchase = usePurchaseVideo();
  const del = useDeleteVideo();

  function onWatch(v: VideoLessonItem) {
    stream.mutate(v.id, {
      onSuccess: (res) => setPlaying({ url: res.url, title: v.title }),
      onError: () => toast.error(tc("unknownError")),
    });
  }
  function onBuy(id: string) {
    purchase.mutate(id, {
      onSuccess: () => toast.success(t("requestSent")),
      onError: () => toast.error(tc("unknownError")),
    });
  }
  function onDelete(id: string) {
    if (!confirm(t("deleteConfirm"))) return;
    del.mutate(id, {
      onSuccess: () => toast.success(t("deleted")),
      onError: () => toast.error(tc("unknownError")),
    });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t("title")}
        actions={
          isOffice ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus />
              {t("create")}
            </Button>
          ) : undefined
        }
      />

      {isOffice && (
        <Tabs value={tab} onValueChange={(v) => setTab(v as "videos" | "purchases")} className="mb-4">
          <TabsList>
            <TabsTrigger value="videos">{t("title")}</TabsTrigger>
            <TabsTrigger value="purchases">{t("purchases")}</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {tab === "purchases" && isOffice ? (
        <PurchasesPanel />
      ) : videosQ.isError ? (
        <ErrorState title={tc("error")} action={<Button variant="outline" size="sm" onClick={() => videosQ.refetch()}>{tc("retry")}</Button>} />
      ) : videosQ.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56" />)}
        </div>
      ) : (videosQ.data?.length ?? 0) === 0 ? (
        <EmptyState icon={Video} title={t("noVideos")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videosQ.data!.map((v) => (
            <TiltCard key={v.id} maxTilt={6} className="h-full rounded-[12px]">
              <Card className="lift group flex h-full flex-col overflow-hidden p-0 hover:border-border-strong">
                {/* muqova */}
                <div className="relative aspect-video overflow-hidden">
                  {v.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.thumbnailUrl}
                      alt={v.title}
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-gradient-to-br from-brand/20 via-accent/10 to-highlight/20">
                      <PlaySquare className="size-11 text-brand/50" />
                    </div>
                  )}

                  {/* pastki qorong'ilashtirish */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                  {/* narx belgisi */}
                  <div className="absolute right-2 top-2">
                    {v.price === 0 ? (
                      <Badge variant="success">{t("free")}</Badge>
                    ) : (
                      <span className="rounded-full bg-black/65 px-2.5 py-1 text-xs font-semibold text-white tabular-nums backdrop-blur">
                        {formatMoney(v.price)} {tc("sum")}
                      </span>
                    )}
                  </div>

                  {/* holat belgisi (yuqori chap) */}
                  {v.access === "pending_confirmation" && (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-warning-bg/90 px-2 py-1 text-[11px] font-semibold text-warning backdrop-blur">
                      <Clock className="size-3" /> {t("pending")}
                    </span>
                  )}
                  {v.access === "locked" && (
                    <span className="absolute left-2 top-2 grid size-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur">
                      <Lock className="size-3.5" />
                    </span>
                  )}

                  {/* "play" qoplamasi — faqat ochilgan videolar uchun */}
                  {v.access === "granted" && (
                    <button
                      type="button"
                      onClick={() => onWatch(v)}
                      aria-label={t("watch")}
                      className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <span className="grid size-14 place-items-center rounded-full bg-white/95 text-brand shadow-lg backdrop-blur transition-transform duration-300 group-hover:scale-110">
                        <Play className="size-6 fill-current" />
                      </span>
                    </button>
                  )}
                </div>

                {/* matn qismi */}
                <div className="flex flex-1 flex-col p-4">
                  <p className="line-clamp-1 font-semibold text-fg">{v.title}</p>
                  {v.description && (
                    <p className="mt-1 line-clamp-2 flex-1 text-sm text-fg-muted">{v.description}</p>
                  )}
                  {v.isFreeForApproved && v.price > 0 && (
                    <Badge variant="info" className="mt-2 w-fit">
                      {t("freeForApproved")}
                    </Badge>
                  )}

                  <div className="mt-3 flex gap-2">
                    {v.access === "granted" ? (
                      <Button size="sm" className="flex-1" loading={stream.isPending} onClick={() => onWatch(v)}>
                        <PlaySquare />
                        {t("watch")}
                      </Button>
                    ) : v.access === "pending_confirmation" ? (
                      <Badge variant="warning" className="flex-1 justify-center py-1.5">
                        <Clock /> {t("pending")}
                      </Badge>
                    ) : isStudent ? (
                      <Button size="sm" variant="outline" className="flex-1" loading={purchase.isPending} onClick={() => onBuy(v.id)}>
                        <ShoppingCart />
                        {t("buy")}
                      </Button>
                    ) : (
                      <Badge variant="neutral" className="flex-1 justify-center py-1.5">
                        <Lock /> {t("locked")}
                      </Badge>
                    )}
                    {role === "super_admin" && (
                      <Button variant="ghost" size="icon-sm" aria-label={tc("delete")} onClick={() => onDelete(v.id)}>
                        <Trash2 className="text-danger" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </TiltCard>
          ))}
        </div>
      )}

      <VideoCreateDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      <Dialog open={!!playing} onOpenChange={(o) => !o && setPlaying(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{playing?.title}</DialogTitle>
          </DialogHeader>
          {playing && (
            <div className="px-5 pb-5">
              <video
                src={playing.url}
                controls
                autoPlay
                className="aspect-video w-full rounded-[10px] bg-black elevated"
              >
                <track kind="captions" />
              </video>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PurchasesPanel() {
  const t = useTranslations("videos");
  const tc = useTranslations("common");
  const { data, isLoading } = useVideoPurchases("pending_confirmation");
  const confirm = useConfirmPurchase();

  const purchases = data ?? [];

  function onConfirm(videoId: string, userId: string) {
    confirm.mutate(
      { videoId, userId },
      {
        onSuccess: () => toast.success(t("confirmed")),
        onError: () => toast.error(tc("unknownError")),
      },
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
      </div>
    );
  }
  if (purchases.length === 0) {
    return <EmptyState icon={CheckCircle2} title={t("noPurchases")} />;
  }

  return (
    <div className="space-y-2">
      {purchases.map((p) => (
        <Card key={p.id} className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="truncate font-medium text-fg">{p.userName}</p>
            <p className="truncate text-xs text-fg-muted">
              {formatPhone(p.userPhone)} · {p.videoTitle}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-sm text-fg-muted tabular-nums">{formatMoney(p.price)}</span>
            <Button size="sm" loading={confirm.isPending} onClick={() => onConfirm(p.videoId, p.userId)}>
              {t("confirm")}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
