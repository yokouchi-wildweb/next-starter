// src/features/core/userProfile/services/server/userProfileService.ts
// ロール別プロフィールを管理するサービス

import {
  getProfile,
  upsertProfile,
  updateProfile,
  deleteProfile,
  hasProfile,
} from "./operations";

export type { ProfileUpsertData, ProfileUpdateData } from "./operations";

export const userProfileService = {
  getProfile,
  upsertProfile,
  updateProfile,
  deleteProfile,
  hasProfile,
};
