// scripts/runner/task/store.ts
// 実行の記録の置き場 = core の taskRun ドメインの task_runs(サービスを動的 import する。読み込みのたびに DB を立ち上げないため)。
// 表が無い(db:push の前)なら止めて pnpm db:push を案内する。
// 利用者: scripts/runner/task/run.ts

import type { TaskRun } from "@/features/core/taskRun/entities/model";

import type { TaskRunStore } from "./execute";

/** 移行の止める鍵(常に掛かる) */
export const migrationKey = (notice: string, name: string): string => `migration:${notice}:${name}`;

/** postgres の「表が無い」(42P01)を pnpm db:push の案内に直す */
function explain(error: unknown): Error {
  const code = (error as { code?: string; cause?: { code?: string } })?.code ?? (error as { cause?: { code?: string } })?.cause?.code;
  if (code === "42P01") return new Error("表 task_runs がありません。pnpm db:push で作ってから打ちます(立ち上げの最初の db:push は記録なしの例外)");
  return error instanceof Error ? error : new Error(String(error));
}

const wrap = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    throw explain(error);
  }
};

export async function dbTaskRunStore(): Promise<TaskRunStore> {
  const service = await import("@/features/core/taskRun/services/server");
  return {
    findKeyHolders: (keys) => wrap(() => service.findKeyHolders(keys)),
    start: (input) => wrap(() => service.startRun(input)),
    finish: (id, input) => wrap(() => service.finishRun(id, input)),
  };
}

/** 人が確かめた結果で running / unknown の行を書き直す(pnpm task --resolve) */
export async function resolveByHand(runId: string, status: "succeeded" | "failed", actor: string): Promise<TaskRun> {
  const service = await import("@/features/core/taskRun/services/server");
  return wrap(() => service.resolveRun(runId, status, `resolved by hand: ${status} (${actor})`));
}
