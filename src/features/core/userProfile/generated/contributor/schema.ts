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
  isApproved: z.coerce.boolean().nullish(),
  approvedAt: z.preprocess(
  (value) => {
    if (value == null) return undefined;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      return trimmed;
    }
    return value;
  },
  z.coerce.date()
).or(z.literal("").transform(() => undefined)).nullish(),
  approvalNote: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
});

export type ContributorProfileData = z.infer<typeof ContributorProfileSchema>;
