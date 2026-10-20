// src/lib/cron/types.ts
// 定期タスク定義の型。
//
// 1 タスク = 1 フォルダ src/app/api/cron/<name>/ に route.ts と task.ts を置く（一覧ファイルは持たない）。
// task.ts がこの型の値 `cronTask` を export し、route.ts・CLI（pnpm task）・vercel.json の生成が同じ定義を読む。

/**
 * 実行頻度の区分。実際の時刻は src/config/app/cron-schedule.config.ts を元に pnpm cron:generate が決める
 * （Vercel Hobby では全区分が 1 日 1 回になる）。
 */
export const CRON_CADENCES = ["15m", "hourly", "daily"] as const;

export type CronCadence = (typeof CRON_CADENCES)[number];

export type CronTaskResult = Record<string, unknown>;

export type CronTaskDefinition<T extends CronTaskResult = CronTaskResult> = {
  /** タスク名 = フォルダ名 = `/api/cron/<name>` と `pnpm task <name>` の名前（ケバブケース） */
  name: string;
  /** 何をするタスクか（`pnpm task --list` に表示される） */
  description: string;
  /** 実行頻度の区分 */
  cadence: CronCadence;
  /**
   * 機能が有効か。false ならルートは本体を呼ばずに skipped を返す（vercel.json には常に載る）。
   * config だけを見る同期関数にする（DB・外部 I/O に触れない = 無効な機能のコストをほぼゼロにするため）。
   * 省略時は常に有効。
   */
  enabled?: () => boolean;
  /**
   * 実行本体。処理はドメイン側に置き、ここでは動的 import で呼ぶだけにする
   * （task.ts を読むだけで DB などの依存を読み込まないため。vercel.json の生成は task.ts を読む）
   */
  run: () => Promise<T>;
};
