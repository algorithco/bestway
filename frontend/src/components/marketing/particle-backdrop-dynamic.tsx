"use client";

import dynamic from "next/dynamic";

const ParticleBackdrop = dynamic(() => import("./particle-backdrop"), {
  ssr: false,
});

export default ParticleBackdrop;
