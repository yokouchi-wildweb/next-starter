// 生成物・編集不可: pnpm generate role が src/domains/core/userProfile/extensionPoints.ts から生成する
// src/domains/core/userProfile/extensions/profileConfigs.ts

import type { ProfileConfig } from "@/domains/core/userProfile/profiles";
import contributorProfile from "@/domains/core/userProfile/profiles/contributor.profile.json";

export const profileConfigs: Record<string, ProfileConfig> = {
  contributor: contributorProfile as ProfileConfig,
};
