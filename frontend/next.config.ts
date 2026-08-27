import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  
  // 1. Turbopack / Webpack tunnelni bloklamasligi uchun (Terminal so'ragan asosiy sozlama)
  allowedDevOrigins: [
    'speeches-sports-performances-vitamin.trycloudflare.com',
    '*.trycloudflare.com'
  ],

  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "3001" },
      { protocol: "https", hostname: "speeches-sports-performances-vitamin.trycloudflare.com" },
      { protocol: "https", hostname: "*.trycloudflare.com" },
      ...(process.env.NEXT_PUBLIC_MEDIA_HOST
        ? [{ protocol: "https" as const, hostname: process.env.NEXT_PUBLIC_MEDIA_HOST }]
        : []),
    ],
  },

  experimental: {
    // Proxy body'larni xotiraga bufferlaydi (default 10MB) — 500MB gacha yuklashlar uchun
    proxyClientMaxBodySize: "500mb",
    serverActions: {
      allowedOrigins: [
        "speeches-sports-performances-vitamin.trycloudflare.com",
        "*.trycloudflare.com"
      ],
    },
  },
};

export default withNextIntl(nextConfig);
