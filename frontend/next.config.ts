import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,

  // 1. Turbopack / Webpack tunnelni bloklamasligi uchun (Terminal so'ragan asosiy sozlama)
  allowedDevOrigins: [
    'speeches-sports-performances-vitamin.trycloudflare.com',
    '*.trycloudflare.com'
  ],

  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24,
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "3001" },
      { protocol: "https", hostname: "speeches-sports-performances-vitamin.trycloudflare.com" },
      { protocol: "https", hostname: "*.trycloudflare.com" },
      // picsum.photos fallback for teachers/gallery
      { protocol: "https", hostname: "picsum.photos" },
      ...(process.env.NEXT_PUBLIC_MEDIA_HOST
        ? [{ protocol: "https" as const, hostname: process.env.NEXT_PUBLIC_MEDIA_HOST }]
        : []),
    ],
  },

  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
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
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "date-fns",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-avatar",
    ],
  },
};

export default withNextIntl(nextConfig);
