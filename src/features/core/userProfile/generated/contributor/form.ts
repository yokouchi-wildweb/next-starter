// src/features/core/userProfile/generated/contributor/form.ts
// 投稿者プロフィールのフォーム型定義
//
// 元情報: src/features/core/userProfile/profiles/contributor.profile.json
// このファイルは role:generate スクリプトによって自動生成されました

import { z } from "zod";
import { ContributorProfileSchema } from "./schema";

/**
 * 投稿者プロフィールのフォーム追加フィールド
 */
export type ContributorProfileAdditional = {
  // foo: string; // フォームに追加する項目
};

/**
 * 投稿者プロフィールのフォームフィールド型
 */
export type ContributorProfileFields = z.infer<typeof ContributorProfileSchema> & ContributorProfileAdditional;
