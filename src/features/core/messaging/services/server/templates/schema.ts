// src/features/core/messaging/services/server/templates/schema.ts
//
// 保存されたテンプレートの入力の zod(形だけ。中身の検査は checks.ts)

import { z } from "zod";

import { MESSAGE_TEMPLATE_STATUSES } from "../../../entities/schema";

/** テンプレートの鍵(英小文字・数字・- _、先頭は英字) */
const TEMPLATE_KEY = /^[a-z][a-z0-9_-]{0,63}$/;

const templateFields = {
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  category: z.string().min(1).max(100),
  channels: z.array(z.string().min(1).max(100)).min(1).max(20),
  content: z.record(z.string(), z.unknown()),
  variables: z.array(z.unknown()).max(100).default([]),
};

export const CreateMessageTemplateInputSchema = z
  .object({ key: z.string().regex(TEMPLATE_KEY, "鍵は英小文字で始まる英小文字・数字・- _(64 文字まで)"), ...templateFields })
  .strict();

export const UpdateMessageTemplateInputSchema = z
  .object({
    name: templateFields.name.optional(),
    description: templateFields.description,
    category: templateFields.category.optional(),
    channels: templateFields.channels.optional(),
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
