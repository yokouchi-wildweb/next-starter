// src/lib/crud/utils/schema.ts

import { z } from "zod";

/**
 * 空文字や null/undefined を適切に処理するnullable日時用Zodスキーマ
 *
 * - 空文字・null・undefined → undefined
 * - 文字列 → トリムして Date に変換
 * - その他 → そのまま Date に変換
 */
export const nullableDatetime = z
  .preprocess((value) => {
    if (value == null) return undefined;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      return trimmed;
    }
    return value;
  }, z.coerce.date())
  .or(z.literal("").transform(() => undefined));

/**
 * required な日時フィールド用Zodスキーマ
 *
 * - null・undefined・空文字 → バリデーションエラー
 * - 文字列 → トリムして Date に変換
 * - その他 → そのまま Date に変換
 */
export const requiredDatetime = z.preprocess((value) => {
  if (value == null) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return trimmed;
  }
  return value;
}, z.coerce.date());
