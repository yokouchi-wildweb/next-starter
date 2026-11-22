// src/domains/core/purchaseQuota/scripts/tasks/cleanup.ts

import type { OneShotTask } from "@/lib/task";

export const task: OneShotTask = {
  name: "purchaseQuota:cleanup",
  run: async () => {
    const { cleanupOldLedger } = await import(
      "@/domains/core/purchaseQuota/services/server/wrappers/purchaseQuotaHelper"
    );
    const deleted = await cleanupOldLedger();
    return { deleted };
  },
};
