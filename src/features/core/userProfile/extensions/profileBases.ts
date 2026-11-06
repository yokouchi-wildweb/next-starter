// 生成物・編集不可: pnpm generate role が src/features/core/userProfile/extensionPoints.ts から生成する
// src/features/core/userProfile/extensions/profileBases.ts

import { createProfileBase } from "@/features/core/userProfile/utils/createProfileBase";
import type { ProfileBase } from "@/features/core/userProfile/types";
import type { ProfileConfig } from "@/features/core/userProfile/profiles";

import { ContributorProfileTable } from "@/features/core/userProfile/entities/profiles/contributor";
import contributorProfile from "@/features/core/userProfile/profiles/contributor.profile.json";

export const profileBases: Record<string, ProfileBase> = {
  contributor: createProfileBase(ContributorProfileTable, { defaultSearchFields: (contributorProfile as ProfileConfig).searchFields }),
};
