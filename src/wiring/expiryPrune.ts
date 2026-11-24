// src/wiring/expiryPrune.ts
//
// 期限の削除(cron expiry-prune)の設定済みの実行。lib/cron の runExpiryRules に、増設点 expiryRules の生成された一覧(src/wiring/cron.ts)を
// 門番で絞って(閉じたドメインの項目を外す)、本物の表(@/lib/cron/server)と一緒に渡す。印(cronCheckpoint)は task.ts が渡す(wiring はドメインを読まない)。
// 設計: src/lib/cron/README.md

import { gate } from "@/featureGate";
import { createDeadline, runExpiryRules, type ExpiryCheckpoint, type ExpiryRunResult } from "@/lib/cron";
import { drizzleExpiryStore } from "@/lib/cron/server";
import { expiryRules } from "@/wiring/cron";

/** 1 回の予算(ms)。締切はここで作る(task.ts は @/lib/cron を値で読まない: cron-route-via-wiring) */
export const EXPIRY_PRUNE_BUDGET_MS = 240_000;

/** 1 回の実行(項目 0 ならすぐ skipped)。budgetMs = 予算(既定 EXPIRY_PRUNE_BUDGET_MS) */
export function runExpiryPrune(deps: { checkpoint: ExpiryCheckpoint; budgetMs?: number }): Promise<ExpiryRunResult> {
  return runExpiryRules({
    items: gate.plugs(expiryRules),
    store: drizzleExpiryStore,
    checkpoint: deps.checkpoint,
    deadline: createDeadline(deps.budgetMs ?? EXPIRY_PRUNE_BUDGET_MS),
  });
}
