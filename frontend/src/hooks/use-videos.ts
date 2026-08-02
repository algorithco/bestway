"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  PurchaseStatus,
  StreamUrl,
  VideoLessonItem,
  VideoPurchaseItem,
} from "@/lib/types";

export function useVideos() {
  return useQuery({
    queryKey: ["videos"],
    queryFn: () => api.get<VideoLessonItem[]>("/videos"),
  });
}

/** GET /videos/:id/stream-url — kirish shu yerda tekshiriladi (on-demand) */
export function useStreamUrl() {
  return useMutation({
    mutationFn: (videoId: string) => api.get<StreamUrl>(`/videos/${videoId}/stream-url`),
  });
}

/** POST /videos/:id/purchase — o'quvchi so'rov qoldiradi */
export function usePurchaseVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (videoId: string) =>
      api.post<{ status: PurchaseStatus }>(`/videos/${videoId}/purchase`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["videos"] }),
  });
}

/** GET /videos/purchases — admin tasdiqlash paneli */
export function useVideoPurchases(status?: PurchaseStatus) {
  return useQuery({
    queryKey: ["video-purchases", status ?? "all"],
    queryFn: () => api.get<VideoPurchaseItem[]>("/videos/purchases", { status }),
  });
}

/** POST /videos/:id/confirm-purchase — admin qo'lda tasdiqlaydi */
export function useConfirmPurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { videoId: string; userId: string }) =>
      api.post(`/videos/${v.videoId}/confirm-purchase`, { userId: v.userId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["video-purchases"] });
      qc.invalidateQueries({ queryKey: ["videos"] });
    },
  });
}

/** POST /videos — multipart yuklash */
export function useCreateVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) => api.post<VideoLessonItem>("/videos", form),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["videos"] }),
  });
}

export function useDeleteVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/videos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["videos"] }),
  });
}
