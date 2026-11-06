// 生成物・編集不可: pnpm generate role が src/features/core/userProfile/profiles/contributor.profile.json から生成する
// src/features/core/userProfile/entities/profiles/contributor/schema.ts
// 投稿者プロフィールのZodスキーマ
//
// 元情報: src/features/core/userProfile/profiles/contributor.profile.json
// このファイルは role:generate スクリプトによって自動生成されました

import { emptyToNull } from "@/utils/string";
import { nullableDatetime } from "@/lib/crud/utils";
import { z } from "zod";

/**
 * 投稿者プロフィールスキーマ
 */
export const ContributorProfileSchema = z.object({
  isApproved: z.coerce.boolean().nullish(),
  approvedAt: nullableDatetime.nullish(),
  approvalNote: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
});

export type ContributorProfileData = z.infer<typeof ContributorProfileSchema>;
