// scripts/tasks/user-status-history-backfill.ts
// 導入時1回だけの過去分復元（定期実行しない。冪等なので再実行は安全）

import type { OneShotTask } from "./types";

export const task: OneShotTask = {
  name: "user-status-history-backfill",
  run: async () => {
    const { backfillStatusHistoryFromAuditLogs } = await import(
      "@/features/core/user/services/server/statusHistoryBackfill"
    );
    return await backfillStatusHistoryFromAuditLogs();
  },
};
