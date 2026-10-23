// src/features/core/storageObject/services/server/sweep.ts
//
// ファイル台帳の掃除（cron storage-sweep の本体）。時間予算つきで 3 種類の行を片付ける。
// 1. 期限切れの pending: deleted（reason expired）にしてから実物を片付ける
//    - session: URI を DELETE してアップロード権を殺してから削除する（cleanupDeletedObject）
//    - put: 署名 URL は期限後に使えなくなるので、期限後に削除して完了にする
// 2. 業務行に紐付かないまま猶予（unattachedGraceSec）を過ぎた ready: deleted（reason expired）にして削除する
//    - attach:false の用途（チャット添付）は対象外。duplicate の失敗で残った複製もここで回収される
// 3. deleted だが実物の削除が済んでいない行の再試行（put は期限後だけ。session はいつでも）
// 紐付いた行と旧 URL（台帳に無い）は対象にならない。
// 物理削除の前に、条件付き UPDATE で採用できない状態にする（並行する attach と競合しても、
// 採用に成功した物は消えない）。同じ処理を重ねて実行しても、途中で止まっても安全（次回に続きを拾う）。
// アップロード権（session URI・署名 URL）は、アプリの期限を過ぎても cloud 側でしばらく生きうる。
// Vercel Hobby では cron が 1 日 1 回なので、期限直後に必ず消えるわけではない。

import { STORAGE_CONFIG } from "@/config/app/storage.config";
import { createDeadline, runBudgetedBatches } from "@/lib/cron";
import type { StoragePurposeMap } from "@/lib/storage";

import { drizzleLedger } from "./ledger/drizzleLedger";
import type { StorageLedger, SweepTarget } from "./ledger/types";
import { getStoragePurposes } from "./purposeSource";
import { storageObjectService, type StorageObjectService } from "./storageObjectService";

export type StorageSweepDeps = {
  ledger: StorageLedger;
  service: Pick<StorageObjectService, "cleanupDeletedObject">;
  purposes: () => StoragePurposeMap;
  now: () => Date;
};

export type StorageSweepOptions = {
  /** 1 回の実行の時間予算（ms）。既定 STORAGE_CONFIG.sweep.budgetMs */
  budgetMs?: number;
  /** 1 チャンクの行数。既定 STORAGE_CONFIG.sweep.chunkSize */
  chunkSize?: number;
};

export type StorageSweepResult = Record<SweepTarget, { processed: number; exhausted: boolean }> & {
  budgetExhausted: boolean;
};

const TARGETS: readonly SweepTarget[] = ["expiredPending", "unattachedReady", "pendingRemoval"];

export function createStorageSweep(deps: StorageSweepDeps) {
  const { ledger, service, purposes, now } = deps;

  /** 1 行を採用できない状態にする（条件付き UPDATE）。他の要求が先に進めていれば false */
  async function claim(target: SweepTarget, id: string, at: Date, readyBefore: Date): Promise<boolean> {
    if (target === "pendingRemoval") return true;
    const marked =
      target === "expiredPending"
        ? await ledger.markDeleted(id, { reason: "expired", at }, { statuses: ["pending"], expiresBefore: at })
        : await ledger.markDeleted(
            id,
            { reason: "expired", at },
            { statuses: ["ready"], unattachedOnly: true, readyBefore },
          );
    return marked !== null;
  }

  return {
    async run(options: StorageSweepOptions = {}): Promise<StorageSweepResult> {
      const deadline = createDeadline(options.budgetMs ?? STORAGE_CONFIG.sweep.budgetMs);
      const chunkSize = options.chunkSize ?? STORAGE_CONFIG.sweep.chunkSize;
      const startedAt = now();
      const readyBefore = new Date(startedAt.getTime() - STORAGE_CONFIG.unattachedGraceSec * 1000);
      const excludePurposes = Object.entries(purposes())
        .filter(([, purpose]) => purpose.attach === false)
        .map(([id]) => id);

      const result = {
        budgetExhausted: false,
      } as StorageSweepResult;

      for (const target of TARGETS) {
        const run = await runBudgetedBatches<string, string>({
          deadline,
          fetchNext: async (cursor) => {
            const ids = await ledger.listSweepTargets(target, {
              now: startedAt,
              readyBefore,
              excludePurposes,
              afterId: cursor ?? null,
              limit: chunkSize,
            });
            return ids.length > 0 ? { items: ids, cursor: ids[ids.length - 1], done: ids.length < chunkSize } : null;
          },
          processChunk: async (ids) => {
            for (const id of ids) {
              if (await claim(target, id, now(), readyBefore)) {
                await service.cleanupDeletedObject(id);
              }
            }
          },
        });
        result[target] = { processed: run.processed, exhausted: run.exhausted };
        if (run.budgetExhausted) {
          result.budgetExhausted = true;
          break;
        }
      }
      for (const target of TARGETS) result[target] ??= { processed: 0, exhausted: false };
      return result;
    },
  };
}

export type StorageSweep = ReturnType<typeof createStorageSweep>;

const defaultSweep = createStorageSweep({
  ledger: drizzleLedger,
  service: storageObjectService,
  purposes: getStoragePurposes,
  now: () => new Date(),
});

/** cron storage-sweep から呼ぶ */
export function runStorageSweep(options?: StorageSweepOptions): Promise<StorageSweepResult> {
  return defaultSweep.run(options);
}
