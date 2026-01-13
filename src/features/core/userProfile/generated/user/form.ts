// src/features/core/userProfile/generated/user/form.ts
// 一般プロフィールのフォーム型定義
//
// 元情報: src/features/core/userProfile/profiles/user.profile.json
// このファイルは role:generate スクリプトによって自動生成されました

import { z } from "zod";
import { UserProfileSchema } from "./schema";

/**
 * 一般プロフィールのフォーム追加フィールド
 */
export type UserProfileAdditional = {
  // foo: string; // フォームに追加する項目
};

/**
 * 一般プロフィールのフォームフィールド型
 */
export type UserProfileFields = z.infer<typeof UserProfileSchema> & UserProfileAdditional;
