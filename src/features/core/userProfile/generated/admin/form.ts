// src/features/core/userProfile/generated/admin/form.ts
// 管理者プロフィールのフォーム型定義
//
// 元情報: src/features/core/userProfile/profiles/admin.profile.json
// このファイルは role:generate スクリプトによって自動生成されました

import { z } from "zod";
import { AdminProfileSchema } from "./schema";

/**
 * 管理者プロフィールのフォーム追加フィールド
 */
export type AdminProfileAdditional = {
  // foo: string; // フォームに追加する項目
};

/**
 * 管理者プロフィールのフォームフィールド型
 */
export type AdminProfileFields = z.infer<typeof AdminProfileSchema> & AdminProfileAdditional;
