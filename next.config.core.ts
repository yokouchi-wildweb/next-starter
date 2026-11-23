// next.config.core.ts
// Next の設定の Tier1 の本体(core)。各リポの素の next.config.ts(型 5 self)がこれを読み、足す・包む・外す。ここは Tier1 だけが書く

import crypto from "node:crypto";
import path from "node:path";
import type { NextConfig } from "next";

import { getAppEnv } from "./src/lib/appEnv";
import { readForkIdentity } from "@/lib/forkOwnership/node.mjs";

// ビルドごとに一意なID（デプロイ検知用）
const buildId = crypto.randomUUID();

// 門番の全開スイッチ FEATURE_GATE_OPEN を本番のビルドで効かせてよいか(Tier1 = fork_id が next-starter のときだけ)。
// 実行時には .claude/rules/project.md を読めないので build 時に計算して inline する(fork の build では fork の project.md から "false")。
// env の inline が勝つので Vercel の環境変数では上書きできない。読み手: src/featureGate/openSwitch.ts
export const featureGateTier1 = String(readForkIdentity(__dirname).isTier1);

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

// 上流の置き場の許可(pnpm check next-config が、各リポの解いた設定にこれが全部残っているかを見る)
export const imageRemotePatterns: ImageRemotePatterns = [
  ...legacyStorageRemotePatterns,
  ...publicStorageRemotePatterns(),
];

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // AI エージェントの下の next dev(16.3 以降)が、追跡中の AGENTS.md に nextjs-agent-rules の塊を書き足すのを止める。
  // エージェントへの案内の中身は CLAUDE.md の側で持つ(AGENTS.md はそこへの入口だけ)。false なら既にある塊も next dev が消す
  agentRules: false,
  // Cache Components(静的な殻 + 実行時の中身の流し込み)を有効にする。両モードで同じ挙動の直しは区切り cc-prep で済み
  // (API と cron の入口の connection()・root layout は request を読まない・セッションは promise・segment config の 5 つの名なし)。
  // root layout の Suspense(fallback null)が Provider と URL を読む葉を殻から外す。fork はこの区間を取り込む時に build の検査を通す。
  // partialPrefetching は段 3(見える読み手ごとの境界)まで false。書かないと Next が警告する(既定が変わる途中の鍵)
  cacheComponents: true,
  partialPrefetching: false,
  generateBuildId: () => buildId,
  env: {
    NEXT_BUILD_ID: buildId,
    // 段階(@/lib/appEnv)。正規化した値(無い・知らない値 = production)をビルドに埋め込み、client でも同じ答えにする
    APP_ENV: getAppEnv(),
    FEATURE_GATE_TIER1: featureGateTier1,
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
    // Firebase Auth handler をプロキシ。project id が未設定(Firebase を使わない・未設定の env)の時は作らない
    // (作ると "https://undefined.web.app" = 他人のサイトへ /__/* を流す)。検査は代わりの id で形を確かめる(scripts/structure/next-config)
    const firebaseProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    return {
      fallback: firebaseProjectId
        ? [{ source: "/__/:path*", destination: `https://${firebaseProjectId}.web.app/__/:path*` }]
        : [],
    };
  },
};


export default nextConfig;
