// src/features/auth/entities/session.ts

import { z } from "zod";

import { GeneralUserSchema } from "@/features/user/entities/schema";

const SessionUserIdSchema = z
  .string({ required_error: "ユーザー ID が不足しています" })
  .trim()
  .min(1, { message: "ユーザー ID が不足しています" });

export const SessionUserSchema = z.object({
  userId: SessionUserIdSchema,
  role: GeneralUserSchema.shape.role,
  status: GeneralUserSchema.shape.status,
  providerType: GeneralUserSchema.shape.providerType,
  providerUid: GeneralUserSchema.shape.providerUid,
  displayName: GeneralUserSchema.shape.displayName,
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
