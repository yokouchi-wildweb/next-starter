// src/features/auth/entities/session.ts

import { z } from "zod";

import { UserCoreSchema } from "@/features/core/user/entities/schema";

const SessionUserIdSchema = z
  .string({ required_error: "ユーザー ID が不足しています" })
  .trim()
  .min(1, { message: "ユーザー ID が不足しています" });

export const SessionUserSchema = z.object({
  userId: SessionUserIdSchema,
  role: UserCoreSchema.shape.role,
  status: UserCoreSchema.shape.status,
  isDemo: UserCoreSchema.shape.isDemo,
  providerType: UserCoreSchema.shape.providerType,
  providerUid: UserCoreSchema.shape.providerUid,
  name: UserCoreSchema.shape.name,
});

export const TokenPayloadSchema = SessionUserSchema.omit({
  userId: true,
}).extend({
  sub: SessionUserIdSchema,
  expiresAt: z
    .string({ required_error: "トークンの有効期限が不足しています" })
    .datetime({ message: "トークンの有効期限が不正です" }),
});

export type SessionUser = z.infer<typeof SessionUserSchema>;
export type TokenPayload = z.infer<typeof TokenPayloadSchema>;

export { SessionUserIdSchema };
