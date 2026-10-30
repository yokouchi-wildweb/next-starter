// scripts/tasks/purchase-quota-cleanup.ts

import type { OneShotTask } from "./types";

export const task: OneShotTask = {
  name: "purchase-quota-cleanup",
  run: async () => {
    const { cleanupOldLedger } = await import(
      "@/features/core/purchaseQuota/services/server/wrappers/purchaseQuotaHelper"
    );
    const deleted = await cleanupOldLedger();
    return { deleted };
  },
};
