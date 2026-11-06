// src/lib/task/index.ts — ワンショット・任意タスクの定義の型(公開の入口はこの 1 つ)
// 定義は scripts/tasks/<name>.ts の export const task(計画書 07 でドメインの features/<domain>/scripts/tasks へ移る)。
// ランナーは scripts/runner/task(pnpm task)。依存なし(features・棚を読まない)。

/** ワンショット・任意タスク(scripts/tasks/<name>.ts の export const task)。定期実行はされない */
export type OneShotTask = {
  /** pnpm task <name> の名前。ファイル名の <name> と同じ */
  name: string;
  /** 重い依存は run の中で動的 import する */
  run: () => Promise<Record<string, unknown>>;
};
