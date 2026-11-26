// src/domains/core/auditLog/entities/auditLogFailed/schema.ts

import { z } from "zod";

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
