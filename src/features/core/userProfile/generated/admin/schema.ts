// src/features/core/userProfile/generated/admin/schema.ts
// 管理者プロフィールのZodスキーマ
//
// 元情報: src/features/core/userProfile/profiles/admin.profile.json
// このファイルは role:generate スクリプトによって自動生成されました

import { z } from "zod";

/**
 * 管理者プロフィールスキーマ
 */
export const AdminProfileSchema = z.object({
  bar: z.enum(["apple", "orange"]),
});

export type AdminProfileData = z.infer<typeof AdminProfileSchema>;
