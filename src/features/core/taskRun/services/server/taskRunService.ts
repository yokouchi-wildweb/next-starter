// src/features/core/taskRun/services/server/taskRunService.ts
// pnpm task の実行の記録の読み書き(書き手は scripts/runner/task だけ)。
//
// - startRun: 走る前に running の行を書く(書けなければ呼び手はタスクを走らせない)
// - finishRun: running の行に結果を書く(running でない行は書き換えない)
// - findKeyHolders: 鍵を持つ行(dry-run でない running / succeeded / unknown)を新しい順に返す
// - findDryRunOf: 同じ名前・同じ中身(file_hash)の成功した dry-run の行(git に入れない移行の本実行の条件)
// - resolveRun: 人が確かめた結果で running / unknown の行を succeeded / failed に書き直す
//
// Date を sql テンプレートに直接埋めないこと(drizzle の set / values 経由で渡す)。

import { and, arrayOverlaps, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors/domainError";

import { TASK_RUN_KEY_HOLDING_STATUSES, type TaskRunStatus } from "@/features/core/taskRun/constants";
import { TaskRunTable } from "@/features/core/taskRun/entities/drizzle";
import type { TaskRun, TaskRunFinishInput, TaskRunStartInput } from "@/features/core/taskRun/entities/model";

const t = TaskRunTable;

const toModel = (row: typeof TaskRunTable.$inferSelect): TaskRun => row as TaskRun;

/** 走る前の行(status running)を書いて返す */
export async function startRun(input: TaskRunStartInput): Promise<TaskRun> {
  const [row] = await db
    .insert(t)
    .values({ ...input, status: "running" })
    .returning();
  return toModel(row);
}

/** running の行に結果を書く。running でない(resolve 済み等)なら書き換えず null */
export async function finishRun(id: string, input: TaskRunFinishInput): Promise<TaskRun | null> {
  const [row] = await db
    .update(t)
    .set({ status: input.status, result: input.result ?? null, error: input.error ?? null, finishedAt: new Date() })
    .where(and(eq(t.id, id), eq(t.status, "running")))
    .returning();
  return row ? toModel(row) : null;
}

/** 鍵のどれかを持つ行(dry-run でない running / succeeded / unknown)、新しい順 */
export async function findKeyHolders(keys: readonly string[]): Promise<TaskRun[]> {
  if (keys.length === 0) return [];
  const rows = await db
    .select()
    .from(t)
    .where(and(arrayOverlaps(t.stopKeys, [...keys]), eq(t.dryRun, false), inArray(t.status, [...TASK_RUN_KEY_HOLDING_STATUSES])))
    .orderBy(desc(t.startedAt));
  return rows.map(toModel);
}

/** 同じ名前・同じ中身(file_hash)の成功した dry-run の行のうち新しい物。無ければ null */
export async function findDryRunOf(name: string, fileHash: string): Promise<TaskRun | null> {
  const [row] = await db
    .select()
    .from(t)
    .where(and(eq(t.name, name), eq(t.fileHash, fileHash), eq(t.dryRun, true), eq(t.status, "succeeded")))
    .orderBy(desc(t.startedAt))
    .limit(1);
  return row ? toModel(row) : null;
}

export async function findRun(id: string): Promise<TaskRun | null> {
  const [row] = await db.select().from(t).where(eq(t.id, id));
  return row ? toModel(row) : null;
}

/** 人が確かめた結果で running / unknown の行を書き直す(succeeded = 鍵を持ち続ける / failed = 鍵を放す) */
export async function resolveRun(id: string, status: Extract<TaskRunStatus, "succeeded" | "failed">, note: string): Promise<TaskRun> {
  const current = await findRun(id);
  if (!current) throw new DomainError(`実行の記録 ${id} がありません`, { status: 404 });
  if (current.status !== "running" && current.status !== "unknown") {
    throw new DomainError(`実行の記録 ${id} は ${current.status} です(書き直せるのは running / unknown だけ)`, { status: 409 });
  }
  const [row] = await db
    .update(t)
    .set({ status, resolvedAt: new Date(), finishedAt: current.finishedAt ?? new Date(), error: [current.error, note].filter(Boolean).join("\n") })
    .where(and(eq(t.id, id), inArray(t.status, ["running", "unknown"])))
    .returning();
  if (!row) throw new DomainError(`実行の記録 ${id} は書き直しの間に変わりました`, { status: 409 });
  return toModel(row);
}
