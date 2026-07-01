// src/lib/gradient/colorValue.ts
// カラー値モデル（default / solid / gradient）の解決・正規化（純粋TS）。

import { isGradient } from "./css";
import { getGradient, listGradients } from "./registry";
import type { ColorValue, ResolveColorContext } from "./types";

/** 値が ColorValue 形（mode を持つオブジェクト）かどうか。 */
export function isColorValue(value: unknown): value is ColorValue {
  return (
    typeof value === "object" &&
    value !== null &&
    "mode" in value &&
    typeof (value as { mode: unknown }).mode === "string"
  );
}

/**
 * ColorValue（または後方互換の生CSS文字列）を最終的なCSS文字列へ解決する。
 *
 * - 生の文字列はそのまま返す（旧データの後方互換）。
 * - "default" の意味は ctx.resolveDefault で消費側が注入する。
 * - "gradient" は登録レジストリの cssValue を返す（未登録なら default にフォールバック）。
 */
export function resolveColorValue(
  value: ColorValue | string | null | undefined,
  ctx: ResolveColorContext = {},
): string {
  const fallback = () => ctx.resolveDefault?.() ?? "";

  if (value == null) return fallback();
  // 後方互換: 旧データの生CSS文字列
  if (typeof value === "string") return value === "" ? fallback() : value;

  switch (value.mode) {
    case "default":
      return fallback();
    case "solid":
      return value.solid || fallback();
    case "gradient":
      return getGradient(value.gradientKey)?.cssValue ?? fallback();
    default:
      return fallback();
  }
}

/** 既知トークンの cssValue と一致する生グラデーション文字列からキーを逆引きする。 */
function findGradientKeyByCss(css: string): string | null {
  const normalized = css.replace(/\s+/g, " ").trim();
  for (const token of listGradients()) {
    if (token.cssValue.replace(/\s+/g, " ").trim() === normalized) {
      return token.key;
    }
  }
  return null;
}

/**
 * 任意の入力（ColorValue / 生CSS文字列 / null）を ColorValue へ正規化する。
 * 旧データ（生CSS文字列で保存された色）を ColorValue モデルへ移行する用途。
 *
 * - null / 空文字 → { mode: "default" }
 * - 既知グラデーションに一致する文字列 → { mode: "gradient", gradientKey }
 * - それ以外の文字列 → { mode: "solid", solid }
 */
export function normalizeColorValue(
  input: ColorValue | string | null | undefined,
): ColorValue {
  if (input == null || input === "") return { mode: "default" };
  if (isColorValue(input)) return input;

  if (typeof input === "string") {
    if (isGradient(input)) {
      const key = findGradientKeyByCss(input);
      if (key) return { mode: "gradient", gradientKey: key };
      // 未知のグラデーション文字列はそのまま solid（生CSS）として保持
    }
    return { mode: "solid", solid: input };
  }

  return { mode: "default" };
}
