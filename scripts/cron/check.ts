#!/usr/bin/env tsx
// scripts/cron/check.ts
// vercel.json の crons が dispatcher 前提の形になっているか検査する（pnpm cron:check）
// pnpm deploy:all がデプロイ前に実行する（cron の配線漏れのまま本番に出さないため）。
//
// 失敗する条件:
// - vercel.json が無い（Vercel にデプロイするなら必須）
// - dispatcher のエントリが hobby / pro どちらの形とも一致しない
// - /api/cron/<task> の個別エントリが残っている（dispatcher と二重実行になる）
// 直し方はどれも `pnpm cron:generate --plan hobby|pro`。詳細: src/lib/cron/README.md

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { checkVercelCrons } from "@/lib/cron/vercelCrons";

function main() {
  const repoRoot = path.resolve(import.meta.dirname, "../..");
  const file = path.join(repoRoot, "vercel.json");

  if (!existsSync(file)) {
    console.error(
      "✗ vercel.json がありません。定期タスク（監査ログ・ログインイベント等の prune を含む）が本番で動きません。\n" +
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

  const { plan, errors } = checkVercelCrons(config.crons);
  if (errors.length > 0) {
    console.error("✗ vercel.json の cron 配線に問題があります:");
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(`✓ vercel.json の cron 配線 OK（plan: ${plan}）`);
}

main();
