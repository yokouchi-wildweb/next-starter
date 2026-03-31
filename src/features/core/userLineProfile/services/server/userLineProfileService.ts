// src/features/userLineProfile/services/server/userLineProfileService.ts

import { base } from "./drizzleBase";
import { linkLineAccount } from "./wrappers/linkLineAccount";
import { unlinkLineAccount } from "./wrappers/unlinkLineAccount";
import { findByLineUserId } from "./wrappers/findByLineUserId";
import { findByUserId } from "./wrappers/findByUserId";

export type { LinkLineAccountOptions } from "./wrappers/linkLineAccount";

export const userLineProfileService = {
  ...base,
  // LINE連携操作
  linkLineAccount,
  unlinkLineAccount,
  // 検索
  findByLineUserId,
  findByUserId,
};
