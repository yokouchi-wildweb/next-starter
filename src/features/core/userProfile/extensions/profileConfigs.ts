// 生成物・編集不可: pnpm generate role が src/features/core/userProfile/extensionPoints.ts から生成する
// src/features/core/userProfile/extensions/profileConfigs.ts

import type { ProfileConfig } from "@/features/core/userProfile/profiles";
import contributorProfile from "@/features/core/userProfile/profiles/contributor.profile.json";

export const profileConfigs: Record<string, ProfileConfig> = {
  contributor: contributorProfile as ProfileConfig,
};
