"use client";

import * as React from "react";
import { Newspaper, Pencil, Plus, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/app/page-header";
import { ArticleFormDialog } from "@/components/articles/article-form-dialog";
import { useArticlesAdmin, useDeleteArticle } from "@/hooks/use-articles";
import type { Article } from "@/lib/types";

export function ArticlesView() {
  const t = useTranslations("articles");
  const tc = useTranslations("common");
  const format = useFormatter();
  const { data, isLoading, isError, refetch } = useArticlesAdmin();
  const del = useDeleteArticle();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editArticle, setEditArticle] = React.useState<Article | null>(null);

  const articles = data ?? [];

  function onDelete(id: string) {
    if (!confirm(t("deleteConfirm"))) return;
    del.mutate(id, {
      onSuccess: () => toast.success(t("deleted")),
      onError: () => toast.error(tc("unknownError")),
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t("title")}
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus />
            {t("create")}
          </Button>
        }
      />

      {isError ? (
        <ErrorState
          title={tc("error")}
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {tc("retry")}
            </Button>
          }
        />
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <EmptyState icon={Newspaper} title={t("empty")} />
      ) : (
        <div className="space-y-2">
          {articles.map((a) => (
            <Card key={a.id} className="flex items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {a.category && <Badge variant="brand">{a.category}</Badge>}
                  <span className="text-xs text-fg-subtle">
                    {format.dateTime(new Date(a.createdAt), {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <p className="mt-1.5 truncate font-medium text-fg">{a.title}</p>
                <p className="mt-0.5 line-clamp-2 text-sm text-fg-muted">{a.body}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("edit")}
                  onClick={() => setEditArticle(a)}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={tc("delete")}
                  onClick={() => onDelete(a.id)}
                >
                  <Trash2 className="text-danger" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ArticleFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <ArticleFormDialog
        open={!!editArticle}
        onClose={() => setEditArticle(null)}
        article={editArticle}
      />
    </div>
  );
}
