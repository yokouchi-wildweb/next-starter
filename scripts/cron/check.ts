#!/usr/bin/env tsx
// scripts/cron/check.ts
// vercel.json の crons が src/app/api/cron/<name>/task.ts からの生成結果と一致するか検査する
//
// 使い方:
//   pnpm cron:check                 # 手元で検査（pnpm deploy:all もデプロイ前に実行する）
//   pnpm cron:check --vercel-build  # build スクリプトから。Vercel 上のビルド（VERCEL=1）のときだけ検査し、それ以外は何もしない
//
// 失敗する条件:
// - vercel.json が無い（cron タスクがあるのに本番で 1 本も動かない）
// - task.ts があるのにエントリが無い（upstream から merge したタスクの配線漏れ等）/ 消えたタスクのエントリが残っている /
//   時刻が生成結果と違う（手で書き換えた、task.ts の schedule を変えて再生成していない）/ task.ts の schedule が不正
// 直し方はどれも `pnpm cron:generate --plan hobby|pro`。
// 定期タスクを意図して 1 本も動かさないデプロイ（デモ環境等）だけは環境変数 SKIP_CRON_CHECK=1 で検査を外す。
// 詳細: src/lib/cron/README.md

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { checkVercelCrons } from "@/lib/cron/vercelCrons";
import { loadCronTasks } from "./discover";

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--vercel-build") && process.env.VERCEL !== "1") return;
  if (process.env.SKIP_CRON_CHECK === "1") {
    console.log("- cron の配線検査を SKIP_CRON_CHECK=1 で外しています（定期タスクは本番で動きません）");
    return;
  }

  const repoRoot = path.resolve(import.meta.dirname, "../..");
  const tasks = await loadCronTasks(repoRoot);
  const file = path.join(repoRoot, "vercel.json");

  if (!existsSync(file)) {
    if (tasks.length === 0) return;
    console.error(
      `✗ vercel.json がありません。cron タスク ${tasks.length} 本（監査ログ・ログインイベント等の prune を含む）が本番で動きません。\n` +
        "  pnpm cron:generate --plan hobby|pro で生成してコミットしてください",
    );
    process.exit(1);
  }

  let config: { crons?: unknown };
  try {
    config = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`✗ vercel.json を JSON として読めません: ${message}`);
    process.exit(1);
  }

  const { plan, errors } = checkVercelCrons(config.crons ?? [], tasks);
  if (errors.length > 0) {
    console.error("✗ vercel.json の cron 配線が src/app/api/cron/*/task.ts と一致しません:");
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(`✓ vercel.json の cron 配線 OK（plan: ${plan}、${tasks.length} タスク）`);
}

main().catch((error) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
