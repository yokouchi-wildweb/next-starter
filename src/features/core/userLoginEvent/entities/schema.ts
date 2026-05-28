// src/features/core/userLoginEvent/entities/schema.ts

import { z } from "zod";

import { USER_LOGIN_EVENT_TYPES } from "@/features/core/userLoginEvent/constants";

/**
 * 書き込み入力のバリデーション。
 *
 * ip は IPv4 / IPv6 / CIDR どれも `inet` 型で受け取れるため、最低限の長さ制限のみ。
 * 厳密な形式チェックは PostgreSQL 側の `inet` パースが担う (不正値は DB エラー)。
 */
export const UserLoginEventCreateSchema = z.object({
  userId: z.string().uuid(),
  eventType: z.enum(USER_LOGIN_EVENT_TYPES),
  ip: z.string().min(1).max(45),
  userAgent: z.string().max(1024).nullable().optional(),
  occurredAt: z.date().optional(),
  retentionDays: z.number().int().positive().max(365 * 50),
});

export type UserLoginEventCreateInput = z.infer<typeof UserLoginEventCreateSchema>;
