// next.config.ts

import crypto from "node:crypto";
import path from "node:path";
import type { NextConfig } from "next";

// ビルドごとに一意なID（デプロイ検知用）
const buildId = crypto.randomUUID();

// 画像最適化 (next/image) の有効化スイッチ。
// IMAGE_OPTIMIZATION=enabled のときだけ Next/Vercel の画像最適化（リサイズ・WebP変換・srcset）を有効にする。
// Vercel では画像最適化が従量課金のため、既定は無効（従来挙動）とし、プロジェクトごとの明示オプトインにしている。
// 効果が及ぶのは next/image を使う表示のみで、raw <img> は影響を受けない。
const imageOptimizationEnabled = process.env.IMAGE_OPTIMIZATION === "enabled";

// next/image で外部画像を扱うための許可リスト。
// 自プロジェクトの Firebase Storage バケットのパスに限定する
// （ホスト全体を許可すると、第三者のファイル最適化に自プロジェクトの課金枠を使われる踏み台になるため）。
const firebaseStorageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const imageRemotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = firebaseStorageBucket
  ? [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: `/v0/b/${firebaseStorageBucket}/o/**`,
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: `/${firebaseStorageBucket}/**`,
      },
    ]
  : [];

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
    unoptimized: !imageOptimizationEnabled,
    remotePatterns: imageRemotePatterns,
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
