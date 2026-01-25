// src/features/core/userProfile/profiles/index.ts
// プロフィール設定の型定義
//
// 各 profile.json は使用箇所で直接インポートすること
// 例: import userProfile from "@/features/core/userProfile/profiles/user.profile.json";

import type { ProfileFieldConfig } from "../types";

// JSON プロフィール設定の読み込み
import contributorProfile from "./contributor.profile.json";

// JSON プロフィール設定の読み込み

/**
 * プロフィール設定の型
 */
export type ProfileConfig = {
  roleId: string;
  fields: ProfileFieldConfig[];
  tags?: Record<string, string[]>;
};
