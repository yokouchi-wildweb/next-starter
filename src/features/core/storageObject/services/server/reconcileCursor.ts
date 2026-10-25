// src/features/core/storageObject/services/server/reconcileCursor.ts
//
// 照合（紐付け先の行がまだあるか）の進み具合。台帳に列を足さず、cron_checkpoints（cronCheckpoint）の 1 行に持つ。
// cron_checkpoints は時刻しか持てないので、台帳 id（uuidv7）の時刻部分（先頭 48 bit = ミリ秒）を入れ、
// 再開は「その時刻の最小の uuidv7」の後から行う。同じミリ秒の行は次回もう一度見るが、照合は何度見ても安全。
// 最後まで行ったら行を消して先頭に戻す（一巡）。uuidv7 でない id（時刻が読めない）は先頭から。

import "server-only";

import { advanceCheckpoint, deleteCheckpoint, findCheckpoint } from "@/features/cronCheckpoint/services/server";

/** 照合の再開位置の保存先。afterId = この id より後から（null = 先頭から） */
export type ReconcileCursor = {
  get(): Promise<string | null>;
  advance(lastId: string): Promise<void>;
  reset(): Promise<void>;
};

export const RECONCILE_CHECKPOINT_NAME = "storage-sweep.reconcile";

const UUIDV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** uuidv7 の時刻部分。uuidv7 でなければ null */
export function uuidv7Time(id: string): Date | null {
  if (!UUIDV7.test(id)) return null;
  const hex = id.slice(0, 8) + id.slice(9, 13);
  return new Date(Number.parseInt(hex, 16));
}

/** その時刻の最小の id（どの uuidv7 よりも小さい）。これより後 = その時刻以降の行 */
export function uuidLowerBoundAt(time: Date): string {
  const hex = Math.max(0, Math.floor(time.getTime())).toString(16).padStart(12, "0").slice(-12);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-0000-0000-000000000000`;
}

export const checkpointReconcileCursor: ReconcileCursor = {
  async get() {
    const row = await findCheckpoint(RECONCILE_CHECKPOINT_NAME);
    return row ? uuidLowerBoundAt(row.checkpointAt) : null;
  },
  async advance(lastId) {
    const time = uuidv7Time(lastId);
    if (time) await advanceCheckpoint(RECONCILE_CHECKPOINT_NAME, time);
  },
  async reset() {
    await deleteCheckpoint(RECONCILE_CHECKPOINT_NAME);
  },
};
