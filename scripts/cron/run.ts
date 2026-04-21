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
