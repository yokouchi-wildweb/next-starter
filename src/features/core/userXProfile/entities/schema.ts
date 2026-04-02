// src/features/userXProfile/entities/schema.ts

import { z } from "zod";

export const UserXProfileCreateSchema = z.object({
  userId: z.string().uuid(),
  xUserId: z.string().min(1),
  username: z.string().nullish(),
  displayName: z.string().nullish(),
  profileImageUrl: z.string().url().nullish(),
  accessTokenEncrypted: z.string().min(1),
  refreshTokenEncrypted: z.string().min(1),
  tokenExpiresAt: z.date(),
  scopes: z.array(z.string()).nullish(),
});

export const UserXProfileUpdateSchema = z.object({
  username: z.string().nullish(),
  displayName: z.string().nullish(),
  profileImageUrl: z.string().url().nullish(),
  accessTokenEncrypted: z.string().min(1).optional(),
  refreshTokenEncrypted: z.string().min(1).optional(),
  tokenExpiresAt: z.date().optional(),
  scopes: z.array(z.string()).nullish(),
});
