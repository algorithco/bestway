"use client";

import { ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { tx } from "./types";

export function Forbidden() {
  const t = useTranslations("examBuilder");
  return (
    <EmptyState
      icon={ShieldAlert}
      title={tx(t, "forbidden", "Not allowed")}
      description={tx(
        t,
        "forbiddenHint",
        "The Exam Builder is available to teachers and administrators.",
      )}
      action={
        <Link href="/mock">
          <Button size="sm" variant="outline">
            {tx(t, "backToExams", "Back to Exams")}
          </Button>
        </Link>
      }
    />
  );
}
