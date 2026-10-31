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
type ImageRemotePatterns = NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>;

const firebaseStorageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const legacyStorageRemotePatterns: ImageRemotePatterns = firebaseStorageBucket
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

// 新しい公開バケット（storage://pub の ref の配信先。src/lib/storage/README.md「表示」）。
// 旧バケットと同じく base のパス配下に限定する。非公開バケットは /api/storage/ 経由で常に unoptimized のため載せない。
// base が未設定・不正な URL なら追加しない（起動は止めない）。
function publicStorageRemotePatterns(): ImageRemotePatterns {
  const raw = process.env.NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL?.trim();
  if (!raw) return [];
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return [];
  }
  if (url.protocol !== "https:") return [];
  const basePath = url.pathname.replace(/\/+$/, "");
  return [
    {
      protocol: "https",
      hostname: url.hostname,
      ...(url.port ? { port: url.port } : {}),
      pathname: `${basePath}/**`,
    },
  ];
}

const imageRemotePatterns: ImageRemotePatterns = [
  ...legacyStorageRemotePatterns,
  ...publicStorageRemotePatterns(),
];

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
      // sharp 0.35 が .node から OS 経由で読む libvips 本体。Next 16.1〜16.2 の Turbopack の追跡に載らず、
      // 無いと本番（Vercel）で ERR_DLOPEN_FAILED になり画像の描き直しが全て失敗する。
      // Next 16.3 以上では追跡に載る。更新したら、関数サイズと読み込みを確かめてこの指定を外す。
      // ※ stripImageMetadata を API ルート以外から呼ぶフォークは、その route キーを追加すること。
      "./node_modules/.pnpm/@img+sharp-libvips-linux-x64@*/node_modules/@img/sharp-libvips-linux-x64/lib/**",
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
