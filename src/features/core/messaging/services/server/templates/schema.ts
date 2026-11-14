// src/features/core/messaging/services/server/templates/schema.ts
//
// 保存されたテンプレートの入力の zod(形だけ。中身の検査は checks.ts)

import { z } from "zod";

import { MESSAGE_TEMPLATE_STATUSES } from "../../../entities/schema";

const templateFields = {
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  category: z.string().min(1).max(100),
  /** 経路ごとの文言(鍵 = 文言のある経路。経路の組は持たない) */
  content: z.record(z.string(), z.unknown()),
  variables: z.array(z.unknown()).max(100).default([]),
};

/** 作る入力。鍵は受けない(サーバーが作る、D46: 運営する人に鍵を打たせない。strict なので key を送ると 400) */
export const CreateMessageTemplateInputSchema = z.object({ ...templateFields }).strict();

export const UpdateMessageTemplateInputSchema = z
  .object({
    name: templateFields.name.optional(),
    description: templateFields.description,
    category: templateFields.category.optional(),
    content: templateFields.content.optional(),
    variables: z.array(z.unknown()).max(100).optional(),
  })
  .strict();

export const ListMessageTemplatesQuerySchema = z.object({
  status: z.enum(MESSAGE_TEMPLATE_STATUSES).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateMessageTemplateInput = z.input<typeof CreateMessageTemplateInputSchema>;
export type UpdateMessageTemplateInput = z.input<typeof UpdateMessageTemplateInputSchema>;
export type ListMessageTemplatesQuery = z.input<typeof ListMessageTemplatesQuerySchema>;
