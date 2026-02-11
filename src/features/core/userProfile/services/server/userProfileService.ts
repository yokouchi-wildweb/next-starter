// src/features/core/userProfile/services/server/userProfileService.ts
// ロール別プロフィールを管理するサービス

import {
  getProfile,
  upsertProfile,
  deleteProfile,
  hasProfile,
} from "./operations";

export type { ProfileUpsertData } from "./operations";

export const userProfileService = {
  getProfile,
  upsertProfile,
  deleteProfile,
  hasProfile,
};
