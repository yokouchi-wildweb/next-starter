// src/lib/gradient/build.ts
// グラデーションCSS文字列の生成ヘルパー（純粋TS）

import type { GradientStop, GradientToken, GradientTokenInput } from "./types";

/** デフォルトのグラデーション角度（deg）。gradient.css の --gradient-angle と一致させること。 */
export const DEFAULT_GRADIENT_ANGLE = 135;

/**
 * 色ストップ配列から linear-gradient の CSS 文字列を生成する。
 * inline style / canvas など実行時用途で使う。
 */
export function buildGradientCss(
  stops: GradientStop[],
  angle: number = DEFAULT_GRADIENT_ANGLE,
): string {
  return `linear-gradient(${angle}deg, ${stops.join(", ")})`;
}

/**
 * 登録形（GradientTokenInput）を確定形（GradientToken）へ射影する。
 * cssValue を既定角度で算出して付与する。
 */
export function toGradientToken(input: GradientTokenInput): GradientToken {
  return {
    key: input.key,
    label: input.label,
    stops: input.stops,
    group: input.group,
    cssValue: buildGradientCss(input.stops, input.angle),
  };
}
