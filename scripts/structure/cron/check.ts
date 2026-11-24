#!/usr/bin/env tsx
// scripts/structure/cron/check.ts
// vercel.json の crons が src/app/api/cron/<name>/task.ts からの生成結果と一致するか検査する
//
// 使い方:
//   pnpm check cron                 # 手元で検査（pnpm live 系もデプロイ前に実行する）
//   pnpm check cron --vercel-build  # build の段階(pnpm check --phase=build)から。Vercel 上のビルド（VERCEL=1）のときだけ検査し、それ以外は何もしない
//
// 失敗する条件:
// - vercel.json が無い（cron タスクがあるのに本番で 1 本も動かない）
// - task.ts があるのにエントリが無い（upstream から merge したタスクの配線漏れ等）/ 消えたタスクのエントリが残っている /
//   時刻が生成結果と違う（手で書き換えた、task.ts の schedule を変えて再生成していない）/ task.ts の schedule が不正
// - crons が repo.json の vercel.plan と違うプランの生成結果になっている / repo.json が読めない
// - 同じ /api/cron/ のパスが crons と schedules の両方に載っている（二重実行）
// 直し方はどれも `pnpm generate cron -- --plan hobby|pro`（二重登録は schedules 側のエントリを消す）。
// vercel.plan が無いときは hobby / pro どちらの生成結果も通し、宣言を促す警告を出す。
// 定期タスクを意図して 1 本も動かさないデプロイ（デモ環境等）だけは環境変数 SKIP_CRON_CHECK=1 で検査を外す。
// 詳細: src/lib/cron/README.md

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { checkVercelCrons, findCronScheduleOverlaps } from "@/lib/cron";
import { readVercelPlan } from "@/lib/forkOwnership/node.mjs";
import { loadCronTasks, scheduledCronTasks } from "./discover";

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--vercel-build") && process.env.VERCEL !== "1") return;
  if (process.env.SKIP_CRON_CHECK === "1") {
    console.log("- cron の配線検査を SKIP_CRON_CHECK=1 で外しています（定期タスクは本番で動きません）");
    return;
  }

  const repoRoot = path.resolve(import.meta.dirname, "../../..");
  const tasks = scheduledCronTasks(await loadCronTasks(repoRoot));
  const file = path.join(repoRoot, "vercel.json");

  if (!existsSync(file)) {
    if (tasks.length === 0) return;
    console.error(
      `✗ vercel.json がありません。cron タスク ${tasks.length} 本（監査ログ・ログインイベント等の prune を含む）が本番で動きません。\n` +
        "  pnpm generate cron -- --plan hobby|pro で生成してコミットしてください",
    );
    process.exit(1);
  }

  const declared = readVercelPlan(repoRoot);
  if (declared.error) {
    console.error(`✗ vercel.plan を読めません: ${declared.error}`);
    process.exit(1);
  }

  let config: { crons?: unknown; schedules?: unknown };
  try {
    config = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`✗ vercel.json を JSON として読めません: ${message}`);
    process.exit(1);
  }

  const crons = config.crons ?? [];
  const { plan, errors: cronErrors } = checkVercelCrons(crons, tasks, declared.plan);
  const errors = [...cronErrors, ...findCronScheduleOverlaps(crons, config.schedules)];
  if (errors.length > 0) {
    console.error("✗ vercel.json の cron 配線が src/app/api/cron/*/task.ts と一致しません:");
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  if (!declared.plan) {
    console.warn(
      `⚠ repo.json に vercel.plan がありません（crons は ${plan} の生成結果として通しました）。` +
        "宣言してください: pnpm workflow repo-json set vercel.plan <hobby|pro>",
    );
  }
  console.log(`✓ vercel.json の cron 配線 OK（plan: ${plan}${declared.plan ? "" : "、未宣言"}、${tasks.length} タスク）`);
}

main().catch((error) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
