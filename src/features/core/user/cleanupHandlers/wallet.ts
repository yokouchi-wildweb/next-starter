// src/features/core/user/cleanupHandlers/wallet.ts
// 全ウォレットの残高（balance / locked_balance）を 0 にクリア + 履歴記録

import { gate } from "@/featureGate";
import { clearBalance } from "@/features/core/wallet/services/server/clearBalance";

import type { UserCleanupItem } from "../services/server/cleanup";

export const handler: UserCleanupItem = {
  required: true,
  enabled: () => gate.enabled("wallet"),
  run: clearBalance,
};
