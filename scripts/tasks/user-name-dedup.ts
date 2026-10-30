// scripts/tasks/user-name-dedup.ts
// 表示名の一意性 (USER_NAME_CONFIG.unique) 有効化時に1回だけ実行する既存重複の解消
// （定期実行しない。冪等なので再実行は安全）
// 使い方: pnpm task user-name-dedup -- --dry-run で対象確認 → dry-run なしで実行

import type { OneShotTask } from "./types";

export const task: OneShotTask = {
  name: "user-name-dedup",
  run: async () => {
    const { dedupUserNames } = await import(
      "@/features/core/user/services/server/nameDedup"
    );
    const args = process.argv.slice(3);
    return await dedupUserNames({ dryRun: args.includes("--dry-run") });
  },
};
