// src/features/core/auditLog/entities/schema.ts

import { z } from "zod";

import { AUDIT_ACTOR_TYPES } from "@/features/core/auditLog/constants";

/**
 * action 名の規約: "<domain>.<entity>.<verb>" 形式。
 * 例: "user.email.changed", "post.published", "order.refunded"
 *
 * 大文字 / ハイフン / 連続ドット / 数字始まりは禁止。
 */
const ACTION_NAME_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

export const AuditLogCreateSchema = z.object({
  targetType: z.string().min(1).max(64),
  targetId: z.string().min(1).max(256),
  actorId: z.string().nullable(),
  actorType: z.enum(AUDIT_ACTOR_TYPES),
  action: z
    .string()
    .min(3)
    .max(128)
    .regex(ACTION_NAME_PATTERN, {
      message: "action は <domain>.<entity>.<verb> 形式（小文字 / アンダースコア / ドット）で記述してください",
    }),
  beforeValue: z.unknown().nullable(),
  afterValue: z.unknown().nullable(),
  context: z.unknown().nullable(),
  metadata: z.unknown().nullable(),
  reason: z.string().nullable(),
  retentionDays: z.number().int().positive().max(365 * 50),
});

export type AuditLogCreateInput = z.infer<typeof AuditLogCreateSchema>;

/**
 * dead-letter テーブルへの退避入力。
 * payload は audit insert に失敗した RecordInput をそのまま格納。
 */
export const AuditLogFailedCreateSchema = z.object({
  payload: z.unknown(),
  errorMessage: z.string().nullable(),
  errorStack: z.string().nullable(),
});

export type AuditLogFailedCreateInput = z.infer<typeof AuditLogFailedCreateSchema>;
