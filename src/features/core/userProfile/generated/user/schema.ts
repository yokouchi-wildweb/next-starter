// src/features/core/userProfile/generated/user/schema.ts
// 一般プロフィールのZodスキーマ
//
// 元情報: src/features/core/userProfile/profiles/user.profile.json
// このファイルは role:generate スクリプトによって自動生成されました

import { emptyToNull } from "@/utils/string";
import { z } from "zod";

/**
 * 一般プロフィールスキーマ
 */
export const UserProfileSchema = z.object({
  foo: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
});

export type UserProfileData = z.infer<typeof UserProfileSchema>;
