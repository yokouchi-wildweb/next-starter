// scripts/tasks/types.ts

/** ワンショット・任意タスク(scripts/tasks/<name>[.<fork の名前>].ts の export const task)。定期実行はされない */
export type OneShotTask = {
  /** pnpm task <name> の名前。ファイル名の <name> と同じ */
  name: string;
  /** 重い依存は run の中で動的 import する */
  run: () => Promise<Record<string, unknown>>;
};
