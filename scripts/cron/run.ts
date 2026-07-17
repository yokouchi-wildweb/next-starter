#!/usr/bin/env tsx
// scripts/cron/run.ts
// cron タスクを CLI から実行するための統合ランナー
//
// 使い方:
//   pnpm cron <task-name>
//   pnpm cron expire-pending-purchases
//   pnpm cron --list            # 登録済みタスク一覧
//
// Vercel 以外のホスティング（Docker / AWS / オンプレ）では、
// 各社スケジューラ（EventBridge / Kubernetes CronJob / 自前 cron）
// から直接このスクリプトを叩く構成が可能。
//
// 新しい cron タスクを追加する場合は、下記 TASKS マップにエントリを追加するだけ。
// API ルート (src/app/api/cron/*) と CLI を同じビジネスロジック関数に接続すること。

type CronTask = () => Promise<Record<string, unknown>>;

/**
 * 登録済み cron タスク
 * ここに追加 = pnpm cron <name> で実行可能になる
 */
const TASKS: Record<string, CronTask> = {
  "expire-pending-purchases": async () => {
    const { expirePendingRequests } = await import(
      "@/features/core/purchaseRequest/services/server/wrappers/purchaseService"
    );
    const expired = await expirePendingRequests();
    return { expired };
  },
  "audit-log-prune": async () => {
    const { pruneExpiredAuditLogs } = await import(
      "@/features/core/auditLog/services/server"
    );
    return await pruneExpiredAuditLogs();
  },
  "audit-log-recover-dead-letter": async () => {
    const { recoverDeadLetterAuditLogs } = await import(
      "@/features/core/auditLog/services/server"
    );
    return await recoverDeadLetterAuditLogs();
  },
  "user-login-event-prune": async () => {
    const { pruneExpiredUserLoginEvents } = await import(
      "@/features/core/userLoginEvent/services/server"
    );
    return await pruneExpiredUserLoginEvents();
  },
  "user-daily-counter-prune": async () => {
    const { pruneExpiredUserDailyCounters } = await import(
      "@/features/core/userCounter/services/server/pruning"
    );
    return await pruneExpiredUserDailyCounters();
  },
  "interaction-event-prune": async () => {
    const { pruneExpiredInteractionEvents } = await import(
      "@/features/core/interactionTracking/services/server"
    );
    return await pruneExpiredInteractionEvents();
  },
  "purchase-quota-cleanup": async () => {
    const { cleanupOldLedger } = await import(
      "@/features/core/purchaseQuota/services/server/wrappers/purchaseQuotaHelper"
    );
    const deleted = await cleanupOldLedger();
    return { deleted };
  },
  "analytics-rollup-daily": async () => {
    const { runDailyRollup } = await import(
      "@/features/core/analytics/services/server/rollup"
    );
    return await runDailyRollup();
  },
  // 使い方: pnpm cron analytics-rollup-backfill -- <metricKey> [--from YYYY-MM-DD] [--to YYYY-MM-DD]
  "analytics-rollup-backfill": async () => {
    const { backfillRollup } = await import(
      "@/features/core/analytics/services/server/rollup"
    );
    // pnpm は "--" をそのまま渡してくるため除去する
    const args = process.argv.slice(3).filter((arg) => arg !== "--");
    const metricKey = args[0];
    if (!metricKey || metricKey.startsWith("--")) {
      throw new Error(
        "使い方: pnpm cron analytics-rollup-backfill -- <metricKey> [--from YYYY-MM-DD] [--to YYYY-MM-DD]",
      );
    }
    const readFlag = (name: string): string | undefined => {
      const index = args.indexOf(`--${name}`);
      return index >= 0 ? args[index + 1] : undefined;
    };
    return await backfillRollup({
      metricKey,
      from: readFlag("from"),
      to: readFlag("to"),
    });
  },
  "wallet-expire-lots": async () => {
    const { sweepExpiredWalletLots } = await import(
      "@/features/core/wallet/services/server/lots/sweepExpiredLots"
    );
    return await sweepExpiredWalletLots();
  },
  "wallet-lots-prune": async () => {
    const { pruneConsumedWalletLots } = await import(
      "@/features/core/wallet/services/server/lots/pruneConsumedLots"
    );
    return await pruneConsumedWalletLots();
  },
  // 導入時1回だけの初期化（定期実行しない。再実行は全ユーザーの失効カウントをリセットするので注意）
  "wallet-lots-init": async () => {
    const { initWalletLots } = await import(
      "@/features/core/wallet/services/server/lots/initWalletLots"
    );
    return await initWalletLots();
  },
  // 導入時1回だけの過去分復元（定期実行しない。冪等なので再実行は安全）
  "user-status-history-backfill": async () => {
    const { backfillStatusHistoryFromAuditLogs } = await import(
      "@/features/core/user/services/server/statusHistoryBackfill"
    );
    return await backfillStatusHistoryFromAuditLogs();
  },
  // 表示名の一意性 (USER_NAME_CONFIG.unique) 有効化時に1回だけ実行する既存重複の解消
  // （定期実行しない。冪等なので再実行は安全）
  // 使い方: pnpm cron user-name-dedup -- --dry-run で対象確認 → dry-run なしで実行
  "user-name-dedup": async () => {
    const { dedupUserNames } = await import(
      "@/features/core/user/services/server/nameDedup"
    );
    const args = process.argv.slice(3);
    return await dedupUserNames({ dryRun: args.includes("--dry-run") });
  },
  // 今後の cron タスクはここに追加
};

async function main() {
  const taskName = process.argv[2];

  if (!taskName || taskName === "--list" || taskName === "-l") {
    console.log("Available cron tasks:");
    for (const name of Object.keys(TASKS)) {
      console.log(`  - ${name}`);
    }
    if (!taskName) {
      console.log("\nUsage: pnpm cron <task-name>");
      process.exit(1);
    }
    return;
  }

  const task = TASKS[taskName];
  if (!task) {
    console.error(`Unknown task: ${taskName}`);
    console.error("Available tasks:", Object.keys(TASKS).join(", "));
    process.exit(1);
  }

  const startedAt = Date.now();
  try {
    const result = await task();
    const durationMs = Date.now() - startedAt;
    console.log(
      JSON.stringify({ level: "info", scope: "cron-cli", task: taskName, ok: true, durationMs, ...result }),
    );
    process.exit(0);
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify({ level: "error", scope: "cron-cli", task: taskName, ok: false, durationMs, error: message }),
    );
    process.exit(1);
  }
}

main();
