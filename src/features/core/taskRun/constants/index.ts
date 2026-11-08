// src/features/core/taskRun/constants/index.ts

/** 実行の種類: ドメインのタスク(scripts/tasks)・移行(scripts/migrations)・名指しで手で打った定期タスク(cron)・全ドメイン共通のデータ操作の書き込み(data = pnpm ops data import / update / delete) */
export const TASK_RUN_KINDS = ["task", "migration", "cron", "data"] as const;
export type TaskRunKind = (typeof TASK_RUN_KINDS)[number];

/**
 * 結果: running = 走っている(終わりの行が書かれずに残れば、落ちたか走っているか分からない = 結果不明と同じに扱う)
 * succeeded / failed = 終わった(failed は書き込み前に止まった物、または止める鍵の無いタスクの失敗)
 * unknown = 止める鍵のあるタスクが走り出してから落ちた(どこまで書いたか分からない。人が確かめて resolve する)
 */
export const TASK_RUN_STATUSES = ["running", "succeeded", "failed", "unknown"] as const;
export type TaskRunStatus = (typeof TASK_RUN_STATUSES)[number];

/** 止める鍵を持っている状態(dry-run でない行のうち) */
export const TASK_RUN_KEY_HOLDING_STATUSES: readonly TaskRunStatus[] = ["running", "succeeded", "unknown"];
