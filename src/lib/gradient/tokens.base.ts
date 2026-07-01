// src/lib/gradient/tokens.base.ts
// upstream 所有のグラデーショントークン定義（単一ソース・オブ・トゥルース）。
//
// このファイルが gradient.css（@utility / CSS変数）の生成元であり、
// 同時に TS から listGradients() 等で列挙可能なデータ源でもある。
//
// 重要:
//   - 値を変更したら `pnpm gradient:gen` で src/styles/gradient.css を再生成し、
//     生成物をコミットすること（生成物コミット方式）。
//   - downstream 固有のグラデーションはこのファイルではなく
//     src/config/app/gradients.config.ts に追加すること（マージ衝突回避のため）。

import type { GradientTokenInput } from "./types";

/**
 * upstream 標準グラデーション。
 * group はピッカーの見出し・CSS生成のセクション分けに使う。
 */
export const BASE_GRADIENTS: GradientTokenInput[] = [
  // ─── セマンティック系（テーマカラーとは独立） ───
  {
    key: "primary",
    label: "プライマリ",
    group: "セマンティック",
    text: true,
    stops: ["oklch(0.72 0.22 350)", "oklch(0.62 0.23 280)"],
  },
  {
    key: "secondary",
    label: "セカンダリ",
    group: "セマンティック",
    text: true,
    stops: ["oklch(0.78 0.12 220)", "oklch(0.68 0.24 310)"],
  },
  {
    key: "accent",
    label: "アクセント",
    group: "セマンティック",
    text: true,
    stops: ["oklch(0.75 0.18 160)", "oklch(0.78 0.12 220)"],
  },
  {
    key: "background",
    label: "背景",
    group: "セマンティック",
    stops: ["oklch(0.75 0.2 350)", "oklch(0.64 0.2 280)"],
  },
  {
    key: "muted",
    label: "ミュート",
    group: "セマンティック",
    stops: ["oklch(0.95 0.01 250)", "oklch(0.9 0.01 270)"],
    darkStops: ["oklch(0.25 0.01 250)", "oklch(0.2 0.01 270)"],
  },
  {
    key: "destructive",
    label: "デストラクティブ",
    group: "セマンティック",
    stops: ["oklch(0.6 0.2 25)", "oklch(0.5 0.22 10)"],
  },

  // ─── 自然・現象系 ───
  {
    key: "ocean",
    label: "オーシャン",
    group: "自然・現象",
    text: true,
    stops: ["oklch(0.6 0.15 220)", "oklch(0.5 0.18 200)"],
  },
  {
    key: "sunset",
    label: "サンセット",
    group: "自然・現象",
    text: true,
    stops: ["oklch(0.7 0.2 50)", "oklch(0.6 0.22 350)"],
  },
  {
    key: "forest",
    label: "フォレスト",
    group: "自然・現象",
    stops: ["oklch(0.55 0.15 145)", "oklch(0.45 0.12 160)"],
  },
  {
    key: "aurora",
    label: "オーロラ",
    group: "自然・現象",
    text: true,
    stops: ["oklch(0.6 0.2 300)", "oklch(0.5 0.18 200)"],
  },
  {
    key: "coral",
    label: "コーラル",
    group: "自然・現象",
    stops: ["oklch(0.7 0.18 20)", "oklch(0.65 0.2 350)"],
  },
  {
    key: "midnight",
    label: "ミッドナイト",
    group: "自然・現象",
    stops: ["oklch(0.35 0.15 270)", "oklch(0.25 0.12 250)"],
  },
];
