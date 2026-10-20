#!/usr/bin/env tsx
// scripts/cron/generate.ts
// vercel.json の crons を src/app/api/cron/<name>/task.ts から生成する（crons 以外のキーと /api/cron/ の外のエントリは保持）
//
// 使い方:
//   pnpm cron:generate --plan hobby   # Vercel Hobby: 全タスクを 1 日 1 回
//   pnpm cron:generate --plan pro     # Vercel Pro:   task.ts の schedule どおり
//
// 再生成が要るとき: タスクのフォルダが増減したとき（upstream からの merge を含む）・task.ts の schedule を変えたとき・
// プランを変えたとき。忘れると Vercel のビルド前検査（pnpm cron:check）で止まる。
// 詳細: src/lib/cron/README.md

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  CRON_PATH_PREFIX,
  CRON_PLANS,
  buildVercelCrons,
  isCronPlan,
  listHobbyDowngradedTasks,
  validateCronSchedules,
} from "@/lib/cron/vercelCrons";
import { loadCronTasks } from "./discover";

const VERCEL_SCHEMA_URL = "https://openapi.vercel.sh/vercel.json";

function readFlag(args: string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const plan = readFlag(args, "plan");
  if (!plan || !isCronPlan(plan)) {
    console.error(`Usage: pnpm cron:generate --plan <${CRON_PLANS.join("|")}>`);
    process.exit(1);
  }

  const repoRoot = path.resolve(import.meta.dirname, "../..");
  const file = path.join(repoRoot, "vercel.json");

  let config: Record<string, unknown> = { $schema: VERCEL_SCHEMA_URL };
  if (existsSync(file)) {
    try {
      config = JSON.parse(readFileSync(file, "utf8"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`✗ vercel.json を JSON として読めません: ${message}`);
      process.exit(1);
    }
  }

  const tasks = await loadCronTasks(repoRoot);
  const scheduleErrors = validateCronSchedules(tasks);
  if (scheduleErrors.length > 0) {
    for (const error of scheduleErrors) console.error(`✗ ${error}`);
    process.exit(1);
  }
  const crons = buildVercelCrons(tasks, plan);
  const before = Array.isArray(config.crons) ? config.crons : [];
  // /api/cron/ の外のエントリは fork 独自のものとして残す
  const kept = before.filter(
    (entry: unknown) =>
      typeof (entry as { path?: unknown })?.path === "string" &&
      !(entry as { path: string }).path.startsWith(CRON_PATH_PREFIX),
  );
  config.crons = [...crons, ...kept];

  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);

  console.log(`✓ vercel.json の crons を生成しました（plan: ${plan}、${crons.length} タスク）`);
  for (const entry of crons) {
    console.log(`    ${entry.schedule.padEnd(14)} ${entry.path}`);
  }
  const downgraded = plan === "hobby" ? listHobbyDowngradedTasks(tasks) : [];
  if (downgraded.length > 0) {
    console.warn(
      `  ⚠ Hobby は 1 日 1 回しか動かせないため、次のタスクを 1 日 1 回にしました: ${downgraded.join(", ")}\n` +
        "    本来の頻度で動かすには Vercel Pro にして pnpm cron:generate --plan pro で再生成する",
    );
  }
  if (kept.length > 0) {
    console.log(`  /api/cron/ 以外のエントリ ${kept.length} 件はそのまま残しています`);
  }
  console.log("  Vercel の環境変数に CRON_SECRET が登録されていることを確認してください");
}

main().catch((error) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
