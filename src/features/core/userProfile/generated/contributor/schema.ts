// src/features/core/userProfile/generated/contributor/schema.ts
// 投稿者プロフィールのZodスキーマ
//
// 元情報: src/features/core/userProfile/profiles/contributor.profile.json
// このファイルは role:generate スクリプトによって自動生成されました

import { emptyToNull } from "@/utils/string";
import { z } from "zod";

/**
 * 投稿者プロフィールスキーマ
 */
export const ContributorProfileSchema = z.object({
  organizationName: z.string().trim().min(1, { message: "組織名は必須です。" }),
  contactPhone: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  bio: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  approvalNote: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
});

export type ContributorProfileData = z.infer<typeof ContributorProfileSchema>;
