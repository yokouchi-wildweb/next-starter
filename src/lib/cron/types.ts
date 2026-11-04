// src/lib/cron/types.ts
// 定期タスク定義の型。
//
// 1 タスク = 1 フォルダ src/app/api/cron/<name>/ に route.ts と task.ts を置く（一覧ファイルは持たない）。
// task.ts がこの型の値 `cronTask` を export し、route.ts・CLI（pnpm task）・vercel.json の生成が同じ定義を読む。

export type CronTaskResult = Record<string, unknown>;

export type CronTaskDefinition<T extends CronTaskResult = CronTaskResult> = {
  /** タスク名 = フォルダ名 = `/api/cron/<name>` と `pnpm task <name>` の名前（ケバブケース） */
  name: string;
  /** 何をするタスクか（`pnpm task --list` に表示される） */
  description: string;
  /**
   * 実行時刻の cron 式（5 フィールド・UTC。例: "* * * * *" = 毎分、"55 14 * * *" = 毎日 JST 23:55）。
   * vercel.json にはこの式がそのまま入る。fork が upstream のタスクの時刻を変える・外すときは同じフォルダの
   * override.ts（CronTaskOverride）を使う（task.ts は編集しない）。
   * Vercel Hobby では 1 日 1 回より細かい式を生成時に 1 日 1 回へ直す（src/lib/cron/README.md）。
   */
  schedule: string;
  /**
   * 機能以外の追加の実行条件。false ならルートと `pnpm task` は本体を呼ばずに skipped を返す（vercel.json には載る）。
   * 機能の入切は書かない: タスクの住所 `/api/cron/<name>` を規則の pathPatterns に載せれば、門番が閉じた機能のタスクを
   * route・`pnpm task` で飛ばし、cron:generate が vercel.json から外す（src/lib/cron/README.md）。
   * config だけを見る同期関数にする（DB・外部 I/O に触れない = 無効なときのコストをほぼゼロにするため）。
   * 省略時は常に有効。
   */
  enabled?: () => boolean;
  /**
   * 実行本体。処理はドメイン側に置き、ここでは動的 import で呼ぶだけにする
   * （task.ts を読むだけで DB などの依存を読み込まないため。vercel.json の生成は task.ts を読む）
   */
  run: () => Promise<T>;
};

/**
 * fork によるタスクの上書き。src/app/api/cron/<name>/override.ts が `cronOverride` として export する。
 * override.ts は fork 所有で、upstream は作らない（upstream の task.ts を編集せずに済ませるため）。
 */
export type CronTaskOverride = {
  /** task.ts の schedule の代わりに使う cron 式（5 フィールド・UTC） */
  schedule?: string;
  /** true なら定期実行しない（vercel.json に載らず、pnpm task --due でも動かない。pnpm task <name> の手動実行は可） */
  disabled?: boolean;
};
