"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { SpecularButton } from "@/components/ui/specular-button";
import { useMe } from "@/hooks/use-me";

export function HeroCta({ label }: { label: string }) {
  const router = useRouter();
  const { data: me, isLoading } = useMe();
  const isLoggedIn = !!me?.user;

  if (isLoading) {
    return <span className="inline-flex h-[52px] w-44 animate-pulse rounded-[14px] bg-border/40" aria-hidden />;
  }

  if (isLoggedIn) return null;

  return (
    <SpecularButton
      size="lg"
      radius={14}
      tint="#89F336"
      tintOpacity={1}
      textColor="#101704"
      lineColor="#FFED29"
      baseColor="#4E9F1E"
      intensity={1.2}
      shineSize={10}
      shineFade={40}
      thickness={1.2}
      followMouse
      proximity={250}
      onClick={() => router.push("/register")}
      className="shadow-lg shadow-brand/20"
    >
      {label}
      <ArrowRight className="size-5" />
    </SpecularButton>
  );
}
