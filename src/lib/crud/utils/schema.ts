// src/lib/crud/utils/schema.ts

import { z } from "zod";

// タイムゾーンオフセットを持たない「時刻付き」日時文字列の検出。
// この形の文字列（例: "2026-07-24 11:00"）は new Date() が実行環境のTZで解釈するため、
// クライアント（JST等）とサーバー（Vercel=UTC等）で保存値が黙ってズレる。
// 200 OK のまま誤った日時が永続化されるサイレントバグの温床のため fail-closed で拒否する。
// 日付のみ（"YYYY-MM-DD"）は ECMAScript 仕様で UTC 固定解釈＝環境非依存のため対象外。
const TZ_NAIVE_DATETIME_PATTERN = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}[ T]\d{1,2}:\d{2}/;
const TZ_OFFSET_SUFFIX_PATTERN = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i;

const isTimezoneNaiveDatetimeString = (value: string): boolean =>
  TZ_NAIVE_DATETIME_PATTERN.test(value) && !TZ_OFFSET_SUFFIX_PATTERN.test(value);

const TZ_NAIVE_DATETIME_MESSAGE =
  "タイムゾーン情報のない日時文字列は受け付けられません。オフセット付きISO8601（例: 2026-01-01T09:00:00+09:00）、epochミリ秒、または Date を送信してください";

const preprocessDatetime = (value: unknown, ctx: z.RefinementCtx): unknown => {
  if (value == null) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (isTimezoneNaiveDatetimeString(trimmed)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: TZ_NAIVE_DATETIME_MESSAGE,
        fatal: true,
      });
      return z.NEVER;
    }
    return trimmed;
  }
  return value;
};

/**
 * 空文字や null/undefined を適切に処理するnullable日時用Zodスキーマ
 *
 * - 空文字・null・undefined → undefined
 * - 文字列 → トリムして Date に変換（TZオフセットなしの時刻付き文字列は拒否）
 * - その他 → そのまま Date に変換
 */
export const nullableDatetime = z
  .preprocess(preprocessDatetime, z.coerce.date())
  .or(z.literal("").transform(() => undefined));

/**
 * required な日時フィールド用Zodスキーマ
 *
 * - null・undefined・空文字 → バリデーションエラー
 * - 文字列 → トリムして Date に変換（TZオフセットなしの時刻付き文字列は拒否）
 * - その他 → そのまま Date に変換
 */
export const requiredDatetime = z.preprocess(preprocessDatetime, z.coerce.date());
