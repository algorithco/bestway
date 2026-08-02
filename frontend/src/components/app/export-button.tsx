"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * CSV eksport — to'g'ridan-to'g'ri proxy orqali yuklab olinadi.
 * Cookie avtomatik ketadi, proxy Bearer qo'shadi, backend CSV qaytaradi
 * (Content-Disposition: attachment — brauzer faylni saqlaydi).
 */
export function ExportButton({ path, label }: { path: string; label?: string }) {
  const tc = useTranslations("common");

  function download() {
    const a = document.createElement("a");
    a.href = `/api/backend${path}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <Button variant="outline" size="sm" onClick={download}>
      <Download />
      {label ?? tc("export")}
    </Button>
  );
}
