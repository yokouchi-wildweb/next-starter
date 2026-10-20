#!/usr/bin/env tsx
// scripts/cron/generate.ts
// vercel.json の crons を dispatcher 前提で生成する（crons 以外のキーは保持）
//
// 使い方:
//   pnpm cron:generate --plan hobby                           # vercel.json（Vercel Hobby: 日次 1 本）
//   pnpm cron:generate --plan pro                             # vercel.json（Pro: 15m / hourly / daily の 3 本）
//   pnpm cron:generate --plan pro --file vercel.json.example  # upstream の見本を更新する
//
// タスクを足しても再生成は不要（dispatcher がレジストリを読む）。
// 再生成が要るのは、プランを変えたときと src/config/app/cron-schedule.config.ts の値を変えたときだけ。
// 詳細: src/lib/cron/README.md

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { CRON_SCHEDULE_CONFIG } from "@/config/app/cron-schedule.config";
import { CRON_PLANS, buildVercelCrons, isCronPlan } from "@/lib/cron/vercelCrons";

const VERCEL_SCHEMA_URL = "https://openapi.vercel.sh/vercel.json";

function readFlag(args: string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const plan = readFlag(args, "plan");
  if (!plan || !isCronPlan(plan)) {
    console.error(`Usage: pnpm cron:generate --plan <${CRON_PLANS.join("|")}> [--file vercel.json]`);
    process.exit(1);
  }

  const repoRoot = path.resolve(import.meta.dirname, "../..");
  const file = path.resolve(repoRoot, readFlag(args, "file") ?? "vercel.json");

  let config: Record<string, unknown> = { $schema: VERCEL_SCHEMA_URL };
  if (existsSync(file)) {
    try {
      config = JSON.parse(readFileSync(file, "utf8"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`✗ ${path.relative(repoRoot, file)} を JSON として読めません: ${message}`);
      process.exit(1);
    }
  }

  const before = Array.isArray(config.crons) ? config.crons : [];
  const crons = buildVercelCrons(plan, CRON_SCHEDULE_CONFIG);
  // crons 以外の非 cron パス（/api/cron/ の外）は fork 独自のものとして残す
  const kept = before.filter(
    (entry: unknown) =>
      typeof (entry as { path?: unknown })?.path === "string" &&
      !(entry as { path: string }).path.startsWith("/api/cron/"),
  );
  config.crons = [...crons, ...kept];

  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);

  const removed = before.length - kept.length;
  console.log(`✓ ${path.relative(repoRoot, file)} の crons を生成しました（plan: ${plan}）`);
  for (const entry of crons) {
    console.log(`    ${entry.schedule.padEnd(14)} ${entry.path}`);
  }
  if (removed > 0) {
    console.log(`  /api/cron/* の既存エントリ ${removed} 件を dispatcher に置き換えました（二重実行防止）`);
  }
  if (kept.length > 0) {
    console.log(`  /api/cron/ 以外のエントリ ${kept.length} 件はそのまま残しています`);
  }
  console.log("  Vercel の環境変数に CRON_SECRET が登録されていることを確認してください");
}

main();
