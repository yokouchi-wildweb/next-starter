// src/lib/cron/types.ts
// 定期タスク定義の型。タスクの一覧（レジストリ）は src/registry/cronTaskRegistry.ts が持つ。
//
// lib は features を import できないため、ここには型と語彙だけを置き、
// 実体（どのタスクがどの関数を呼ぶか）はレジストリ側で組み立てる。

/**
 * 実行頻度の区分。dispatcher（/api/cron/dispatch/<cadence>）がこの単位でまとめて起動する。
 * 実際の時刻・間隔は src/config/app/cron-schedule.config.ts（Vercel の場合は生成された vercel.json）が決める。
 */
export const CRON_CADENCES = ["15m", "hourly", "daily"] as const;

export type CronCadence = (typeof CRON_CADENCES)[number];

/** dispatcher の起動単位。"all" は全頻度のタスクを一度に起動する（日次しか回せない Vercel Hobby 用） */
export type CronDispatchCadence = CronCadence | "all";

export type CronTaskResult = Record<string, unknown>;

export type CronTaskDefinition<T extends CronTaskResult = CronTaskResult> = {
  /** タスク名 = `/api/cron/<name>` と `pnpm task <name>` の名前（ケバブケース） */
  name: string;
  /** 何をするタスクか（`pnpm task --list` に表示される。fork 独自タスクの説明もここに書く） */
  description: string;
  /** 実行頻度の区分 */
  cadence: CronCadence;
  /**
   * 機能が有効か。false なら dispatcher は起動せず、個別ルートも本体を呼ばずに skipped を返す。
   * config だけを見る同期関数にする（DB・外部 I/O に触れない = 無効な機能のコストをゼロにするため）。
   * 省略時は常に有効。
   */
  enabled?: () => boolean;
  /** 実行本体。API ルートと CLI の両方から呼ばれる */
  run: () => Promise<T>;
};
