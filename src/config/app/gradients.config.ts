// src/config/app/gradients.config.ts
// downstream（フォーク先）固有のグラデーショントークンを宣言する拡張ポイント。
//
// これにより upstream の src/styles/core/gradient.default.css や tokens.base.ts を直接編集せずに
// プロジェクト固有のグラデーションを追加できる（マージ衝突回避・所有権の明確化）。
//
// 使い方:
//   1. 下の配列にトークンを追加する。
//   2. `pnpm generate styles` で src/styles/gradient.css(このリポの分。global.css が読む)を再生成し、生成物をコミットする。
//      上流の既定 src/styles/core/gradient.default.css も同時に書き直されるが、中身は上流と同じ(fork の差分は出ない)。
//   3. TS 側（listGradients() / getGradient() / <ColorValueInput>）には即座に反映される。
//
// 例:
//   export const customGradients: GradientTokenInput[] = [
//     { key: "tier-s", label: "Sランク", group: "ランク",
//       stops: ["oklch(0.85 0.18 95)", "oklch(0.7 0.2 40)"], text: true },
//   ];

import type { GradientTokenInput } from "@/lib/gradient/types";

/** プロジェクト固有グラデーション（既定: 空。フォーク先で追加する）。 */
export const customGradients: GradientTokenInput[] = [];
