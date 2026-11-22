// 生成物・編集不可: pnpm generate role が src/domains/core/userProfile/extensionPoints.ts から生成する
// src/domains/core/userProfile/extensions/profileBases.ts

import { createProfileBase } from "@/domains/core/userProfile/utils/createProfileBase";
import type { ProfileBase } from "@/domains/core/userProfile/types";
import type { ProfileConfig } from "@/domains/core/userProfile/profiles";

import { ContributorProfileTable } from "@/domains/core/userProfile/entities/profiles/contributor";
import contributorProfile from "@/domains/core/userProfile/profiles/contributor.profile.json";

export const profileBases: Record<string, ProfileBase> = {
  contributor: createProfileBase(ContributorProfileTable, { defaultSearchFields: (contributorProfile as ProfileConfig).searchFields }),
};
