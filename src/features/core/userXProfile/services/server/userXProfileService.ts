// src/features/userXProfile/services/server/userXProfileService.ts

import { base } from "./drizzleBase";
import { linkXAccount } from "./wrappers/linkXAccount";
import { unlinkXAccount } from "./wrappers/unlinkXAccount";
import { findByUserId } from "./wrappers/findByUserId";
import { findByXUserId } from "./wrappers/findByXUserId";
import { getValidClient } from "./wrappers/getValidClient";
import { updateTokens } from "./wrappers/updateTokens";

export type { LinkXAccountOptions } from "./wrappers/linkXAccount";

export const userXProfileService = {
  ...base,
  // X 連携操作
  linkXAccount,
  unlinkXAccount,
  // 検索
  findByUserId,
  findByXUserId,
  // トークン管理
  getValidClient,
  updateTokens,
};
