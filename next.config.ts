// next.config.ts

import crypto from "node:crypto";
import path from "node:path";
import type { NextConfig } from "next";

// ビルドごとに一意なID（デプロイ検知用）
const buildId = crypto.randomUUID();

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  generateBuildId: () => buildId,
  env: {
    NEXT_BUILD_ID: buildId,
  },
  serverExternalPackages: ["firebase-admin", "mediainfo.js"],
  // mediaProbe（@/lib/mediaProbe）が使う mediainfo.js の WASM をサーバーレス関数バンドルへ
  // 明示同梱する。実行時パス構築（Turbopack 回避）にしているため nft の静的検出が効かず、
  // この明示指定が無いと本番（Vercel）で MediaInfoModule.wasm が ENOENT になる。
  // ※ probeMedia を API ルート以外（SSR ページ / Server Action 等）から呼ぶフォークは、
  //   その route キーを追加すること。pnpm のネスト構造に対応するためバージョンはワイルドカード。
  outputFileTracingIncludes: {
    "/api/**": [
      "./node_modules/.pnpm/mediainfo.js@*/node_modules/mediainfo.js/dist/MediaInfoModule.wasm",
      "./node_modules/mediainfo.js/dist/MediaInfoModule.wasm",
    ],
  },
  images: {
    unoptimized: true,
  },
  turbopack: {
    resolveAlias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@": path.resolve(__dirname, "src"),
    };

    return config;
  },
  async rewrites() {
    const firebaseProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    return {
      fallback: [
        {
          // Firebase Auth handler をプロキシ
          source: "/__/:path*",
          destination: `https://${firebaseProjectId}.web.app/__/:path*`,
        },
      ],
    };
  },
};


export default nextConfig;
