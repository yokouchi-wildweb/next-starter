// src/features/referral/services/server/referralService.ts

import { base } from "./drizzleBase";
import { createReferralFromRedemption } from "./wrappers/createReferralFromRedemption";
import { getByInvitee } from "./wrappers/getByInvitee";
import { getByInviter } from "./wrappers/getByInviter";
import { getInviteCodeListWithCounts } from "./wrappers/getInviteCodeListWithCounts";

export const referralService = {
  ...base,
  // クーポン使用 → referral 作成
  createReferralFromRedemption,
  // 紹介元・紹介先の取得
  getByInvitee,
  getByInviter,
  // 管理画面用: 招待コード発行者一覧 + 紹介人数
  getInviteCodeListWithCounts,
};
