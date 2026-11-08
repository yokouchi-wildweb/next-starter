// src/lib/task/index.ts — ドメインのタスク・移行の定義の型(公開の入口はこの 1 つ)
// 定義は src/features/<ドメイン>/scripts/{tasks,migrations}/<名前>.ts の export const task(README.md)。
// ランナーは scripts/runner/task(pnpm task)。依存なし(features・棚を読まない)。

/** ドメインのタスク・移行(src/features/<ドメイン>/scripts/{tasks,migrations}/<名前>.ts の export const task)。定期実行はされない */
export type OneShotTask = {
  /** pnpm task の名前 = <ドメイン>:<ファイル名>(タスクか移行かは置いたフォルダで決まる) */
  name: string;
  /** 重い依存は run の中で動的 import する */
  run: () => Promise<Record<string, unknown>>;
};
