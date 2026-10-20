// src/config/app/cron-schedule.config.ts
// 定期タスクの頻度区分ごとの実行時刻（cron 式・UTC）
// ※ダウンストリームで編集対象：値を書き換えたら `pnpm cron:generate --plan hobby|pro` で vercel.json を再生成する
//
// どのタスクがどの区分かは src/registry/cronTaskRegistry.ts が決める。
// Vercel Hobby（--plan hobby）は daily の時刻に全区分のタスクをまとめて 1 日 1 回起動する。
// 詳細: src/lib/cron/README.md

import type { CronScheduleConfig } from "@/lib/cron/vercelCrons";

export const CRON_SCHEDULE_CONFIG: CronScheduleConfig = {
  /** 15 分ごと */
  "15m": "*/15 * * * *",
  /** 毎時（毎時 0 分の集中を避けてずらす） */
  hourly: "10 * * * *",
  /** 1 日 1 回。18:00 UTC = 03:00 JST（深夜帯） */
  daily: "0 18 * * *",
};
