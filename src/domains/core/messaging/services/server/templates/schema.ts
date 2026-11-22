// src/domains/core/messaging/services/server/templates/schema.ts
//
// 保存されたテンプレートの入力の zod(形だけ。中身の検査は checks.ts)

import { z } from "zod";

import { MESSAGE_KINDS } from "@/lib/messaging";

const templateFields = {
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  category: z.string().min(1).max(100),
  /** レイアウトの鍵(管理者が選べる物) */
  layout: z.string().min(1).max(100),
  /** レイアウトの欄の中身({{鍵}} / {{別名}} のまま。欄の検査は checks.ts) */
  values: z.record(z.string(), z.unknown()),
  /** 専用の埋め込み情報の宣言(形の検査は checks.ts) */
  vars: z.array(z.unknown()).max(100).default([]),
};

/** 作る入力。鍵は受けない(サーバーが作る、D46: 運営する人に鍵を打たせない。strict なので key を送ると 400) */
export const CreateMessageTemplateInputSchema = z.object({ ...templateFields }).strict();

export const UpdateMessageTemplateInputSchema = z
  .object({
    name: templateFields.name.optional(),
    description: templateFields.description,
    category: templateFields.category.optional(),
    layout: templateFields.layout.optional(),
    values: templateFields.values.optional(),
    vars: z.array(z.unknown()).max(100).optional(),
  })
  .strict();

export const ListMessageTemplatesQuerySchema = z.object({
  /** 種別で絞る(その種別のカテゴリーのテンプレート、D135) */
  kind: z.enum(MESSAGE_KINDS).optional(),
  /** 文字検索: 名前か文面(欄の中身の文字列のどれか: 件名・本文・ブロックの字・ボタンの字など。欄の名前はレイアウトが決める)に含む */
  q: z.string().trim().min(1).max(100).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** レイアウトのプレビューの入力(保存しない中身。{{名前}} はそのまま) */
export const PreviewMessageLayoutInputSchema = z
  .object({
    layout: z.string().min(1).max(100),
    channel: z.string().min(1).max(100),
    /** 送るカテゴリー(あれば停止のリンクの見本) */
    category: z.string().min(1).max(100).optional(),
    values: z.record(z.string(), z.unknown()),
  })
  .strict();

export type CreateMessageTemplateInput = z.input<typeof CreateMessageTemplateInputSchema>;
export type UpdateMessageTemplateInput = z.input<typeof UpdateMessageTemplateInputSchema>;
export type ListMessageTemplatesQuery = z.input<typeof ListMessageTemplatesQuerySchema>;
export type PreviewMessageLayoutInput = z.input<typeof PreviewMessageLayoutInputSchema>;
