// src/features/userLineProfile/entities/schema.ts

import { z } from "zod";

export const UserLineProfileCreateSchema = z.object({
  userId: z.string().uuid(),
  lineUserId: z.string().min(1),
  displayName: z.string().nullish(),
  pictureUrl: z.string().url().nullish(),
});

export const UserLineProfileUpdateSchema = z.object({
  displayName: z.string().nullish(),
  pictureUrl: z.string().url().nullish(),
});
