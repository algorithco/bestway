"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { SpecularButton } from "@/components/ui/specular-button";

export function HeroCta({ label }: { label: string }) {
  const router = useRouter();
  return (
    <SpecularButton
      size="lg"
      radius={14}
      tint="#128139"
      tintOpacity={1}
      textColor="#ffffff"
      lineColor="#ffffff"
      baseColor="#0d6a2d"
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
