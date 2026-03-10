// src/registry/profileBaseRegistry.ts
// ロール → プロフィールベースのマッピング（自動生成）
//
// このファイルは role:generate スクリプトによって自動生成されました
//
// ヘルパー関数は @/features/core/userProfile/utils/profileBaseHelpers を使用してください

import { createProfileBase } from "@/features/core/userProfile/utils/createProfileBase";
import type { ProfileBase } from "@/features/core/userProfile/types";
import type { ProfileConfig } from "@/features/core/userProfile/profiles";

import { ContributorProfileTable } from "@/features/core/userProfile/generated/contributor";
import contributorProfile from "@/features/core/userProfile/profiles/contributor.profile.json";

/**
 * ロール → プロフィールベースのマッピング
 */
export const PROFILE_BASE_REGISTRY: Record<string, ProfileBase> = {
  contributor: createProfileBase(ContributorProfileTable, { defaultSearchFields: (contributorProfile as ProfileConfig).searchFields }),
};
