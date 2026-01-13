// src/features/core/userProfile/registry/profileBases.ts
// ロール → プロフィールベースのマッピング（自動生成部分のみ）
//
// このファイルは roles.config.ts から自動生成されます。
// アンカーコメント間のコードは自動生成スクリプトによって更新されます。
// ユーティリティ関数は index.ts に配置してください。

import { createProfileBase } from "../utils/createProfileBase";
import type { ProfileBase } from "../types";

// === AUTO-GENERATED IMPORTS START ===
import { ContributorProfileTable } from "../entities/contributorProfile";
// === AUTO-GENERATED IMPORTS END ===

/**
 * ロール → プロフィールベースのマッピング
 */
export const PROFILE_BASE_REGISTRY: Record<string, ProfileBase> = {
  // === AUTO-GENERATED ENTRIES START ===
  contributor: createProfileBase(ContributorProfileTable),
  // === AUTO-GENERATED ENTRIES END ===
};
