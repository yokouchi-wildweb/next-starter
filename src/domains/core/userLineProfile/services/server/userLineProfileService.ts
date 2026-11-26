// src/domains/userLineProfile/services/server/userLineProfileService.ts

import { userLineProfileBase } from "./userLineProfileBase";
import { linkLineAccount } from "./wrappers/linkLineAccount";
import { unlinkLineAccount } from "./wrappers/unlinkLineAccount";
import { findByLineUserId } from "./wrappers/findByLineUserId";
import { findByUserId } from "./wrappers/findByUserId";

export type { LinkLineAccountOptions } from "./wrappers/linkLineAccount";

export const userLineProfileService = {
  ...userLineProfileBase,
  // LINE連携操作
  linkLineAccount,
  unlinkLineAccount,
  // 検索
  findByLineUserId,
  findByUserId,
};
