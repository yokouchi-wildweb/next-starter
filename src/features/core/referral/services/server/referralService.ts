// src/features/referral/services/server/referralService.ts

import { base } from "./drizzleBase";
import { createReferralFromRedemption } from "./wrappers/createReferralFromRedemption";
import { getByInvitee } from "./wrappers/getByInvitee";
import { getByInviter } from "./wrappers/getByInviter";

export const referralService = {
  ...base,
  // クーポン使用 → referral 作成
  createReferralFromRedemption,
  // 紹介元・紹介先の取得
  getByInvitee,
  getByInviter,
};
