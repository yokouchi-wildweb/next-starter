// src/features/card/entities/schemaRegistry.ts

import { z } from "zod";

// 共通フィールド定義
export const CardBaseSchema = z.object({
  titleId: z.string().min(1, { message: "タイトルIDは必須" }),
  rarityId: z.string().min(1, { message: "レアリティIDは必須" }),
  name: z.string().min(1, { message: "カード名は必須" }),
  modelNumber: z.string().nullish(),
  marketPrice: z.coerce.number().int().nullish(),
  pointValue: z.coerce.number().int().nullish(),
  cardType: z.enum(["real", "virtual"]),
  state: z.enum(["active", "inactive"]),
  description: z.string().nullish(),
  // Firebase Storage に保存された画像のURL
  mainImageUrl: z
    .string()
    .min(1, { message: "カード画像は必須です" })
    .nullish(),
  tagIds: z.array(z.string()).optional().default([]),
  seriesIds: z.array(z.string()).optional().default([]),
});

// フォームの型と API 用の型を分離するため
// スキーマでは画像ファイルなどの一時フィールドを定義せず
// 追加の値は `z.object().passthrough()` で許可する
export const CardCreateSchema = CardBaseSchema.passthrough();

// 更新時は全フィールドを任意とする
export const CardUpdateSchema = CardBaseSchema.partial().passthrough();
