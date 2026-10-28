// src/features/core/storageObject/services/server/sweep.ts
//
// ファイル台帳の掃除（cron storage-sweep の本体）。時間予算つきで 4 種類の行を片付ける。
// 1. 期限切れの pending: deleted（reason expired）にしてから実物を片付ける
//    - session: URI を DELETE してアップロード権を殺してから削除する（cleanupDeletedObject）
//    - put: 署名 URL は期限後に使えなくなるので、期限後に削除して完了にする
// 2. 業務行に紐付かないまま猶予（unattachedGraceSec）を過ぎた ready: deleted（reason expired）にして削除する
//    - attach:false の用途（チャット添付）は対象外。duplicate の失敗で残った複製もここで回収される
// 3. deleted だが実物の削除が済んでいない行の再試行（put は期限後だけ。session はいつでも）
// 4. 照合: 紐付け先の業務行が消えた ready（DB の onDelete cascade・手作業の DELETE などアプリを通らない削除）。
//    record_type から lookupService で業務行のサービスを引き、searchWithDeleted で行の有無を調べ、
//    無い行の紐付けを detach（reason record_removed）して実物を消す。論理削除済みの行は「ある」と数える。
//    引けない record_type（未登録・読み込み失敗・searchWithDeleted が無い）は消さずに警告する。
//    大量一致（STORAGE_CONFIG.sweep.reconcile.massMissingMin）と 1 回の上限（maxDetachPerRun）で止まる。
//    行がある紐付けは、その列（record_field）の値にまだ ref が入っているかも見る（valueCheck）。
//    列の削除・生 SQL や移行での書き換えなど、アプリを通らずに値から外れた ref を拾う。
//    "report" は件数を結果と警告に出すだけ、"detach" は外して（reason unreferenced）実物を消す。
//    列はあるのに 1 つの束で massMissingMin 以上の値が 1 件も入っていなければ、読み出しの取り違えを疑って消さない。
//    進み具合は cron_checkpoints に持ち（reconcileCursor.ts）、毎回続きから台帳を一巡する。
// 旧 URL（台帳に無い）は対象にならない。
// 物理削除の前に、条件付き UPDATE で採用できない状態にする（並行する attach・置換と競合しても、
// 採用に成功した物は消えない）。同じ処理を重ねて実行しても、途中で止まっても安全（次回に続きを拾う）。
// アップロード権（session URI・署名 URL）は、アプリの期限を過ぎても cloud 側でしばらく生きうる。
// Vercel Hobby では cron が 1 日 1 回なので、期限直後に必ず消えるわけではない。

import { STORAGE_CONFIG } from "@/config/app/storage.config";
import { createDeadline, runBudgetedBatches } from "@/lib/cron";
import { CRUD_ID_FIELD } from "@/lib/crud/types";
import type { DomainService, DomainServiceLookup } from "@/lib/domain/types";
import { parseStorageRef, type StoragePurposeMap } from "@/lib/storage";

import { drizzleLedger } from "./ledger/drizzleLedger";
import type { AttachedObjectRef, StorageLedger, SweepTarget } from "./ledger/types";
import { getStoragePurposes } from "./purposeSource";
import { checkpointReconcileCursor, type ReconcileCursor } from "./reconcileCursor";
import { storageObjectService, type StorageObjectService } from "./storageObjectService";

/**
 * 台帳の record_type（= 登録表のキー）から業務行のサービスを引く口（照合用）。
 * cron の task.ts が src/wiring/domains.ts の lookupDomainService を渡す（features は登録表を直接引かない）。
 * 契約: 引けない（未登録・読み込み失敗・searchWithDeleted が無い）は status で返り、「行なし」（found で検索結果が空）と区別できる。
 * 照合は `lookupService(recordType, { require: ["searchWithDeleted"] })` で呼ぶ
 */
export type StorageSweepServiceLookup = (
  key: string,
  options?: { require?: ReadonlyArray<keyof DomainService> },
) => Promise<DomainServiceLookup>;

export type StorageSweepDeps = {
  ledger: StorageLedger;
  service: Pick<StorageObjectService, "cleanupDeletedObject">;
  purposes: () => StoragePurposeMap;
  now: () => Date;
  /** record_type → 業務行のサービス（照合用） */
  lookupService: StorageSweepServiceLookup;
  /** 照合の再開位置 */
  reconcileCursor: ReconcileCursor;
};

export type StorageSweepOptions = {
  /** 1 回の実行の時間予算（ms）。既定 STORAGE_CONFIG.sweep.budgetMs */
  budgetMs?: number;
  /** 1 チャンクの行数。既定 STORAGE_CONFIG.sweep.chunkSize */
  chunkSize?: number;
  /** 1 回の実行で照合が片付けてよい行数。既定 STORAGE_CONFIG.sweep.reconcile.maxDetachPerRun */
  maxDetachPerRun?: number;
  /** 大量一致とみなす ID 数。既定 STORAGE_CONFIG.sweep.reconcile.massMissingMin */
  massMissingMin?: number;
  /** 行はあるが値に ref が無い台帳行の扱い。既定 STORAGE_CONFIG.sweep.reconcile.valueCheck */
  valueCheck?: ReconcileValueCheck;
};

/** 照合で消さずに飛ばした理由（record_type ごと。detach_limit は照合全体を止めた） */
export type ReconcileSkipReason = "unregistered" | "load_failed" | "unsupported" | "mass_missing" | "detach_limit";

export type ReconcileSkip = { recordType: string; reason: ReconcileSkipReason; detail?: string };

/** 照合の値の検査（valueCheck）の扱い。STORAGE_CONFIG.sweep.reconcile.valueCheck */
export type ReconcileValueCheck = "off" | "report" | "detach";

/**
 * 行はあるが、紐付け先の列の値に ref が無い台帳行（表・列・理由ごとの件数）。
 * column_missing = 行にその列のキーが無い（列の削除）| value_missing = 列はあるが値に入っていない
 * action: reported = 報告だけ（report）| detached = 外して実物を消した（detach）| held = 大量一致で消さなかった
 */
export type ReconcileUnreferenced = {
  recordType: string;
  recordField: string;
  reason: "column_missing" | "value_missing";
  action: "reported" | "detached" | "held";
  count: number;
};

export type StorageSweepResult = Record<SweepTarget, { processed: number; exhausted: boolean }> & {
  /** 照合（紐付け先の行が消えた ready）。processed = 調べた台帳行の数 */
  orphanedAttached: { processed: number; exhausted: boolean };
  /** detached = 外した台帳行の合計（行が消えた + 値に無い）| unreferenced = 値の検査の内訳 */
  reconcile: { detached: number; skipped: ReconcileSkip[]; unreferenced: ReconcileUnreferenced[] };
  budgetExhausted: boolean;
};

const TARGETS: readonly SweepTarget[] = ["expiredPending", "unattachedReady", "pendingRemoval"];

/** 列の値（ref 1 つか ref の配列）に、その台帳行の ref が入っているか（ref の中の台帳 ID で比べる） */
function holdsLedgerRef(value: unknown, ledgerId: string): boolean {
  const values = Array.isArray(value) ? value : [value];
  return values.some((item) => typeof item === "string" && parseStorageRef(item)?.ledgerId === ledgerId);
}

export function createStorageSweep(deps: StorageSweepDeps) {
  const { ledger, service, purposes, now, lookupService, reconcileCursor } = deps;

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

  /** 照合（4）。時間予算は既存 3 種と共有し、その後に回す（既存の片付けを飢えさせない） */
  async function reconcile(
    deadline: Date,
    chunkSize: number,
    limits: { maxDetachPerRun: number; massMissingMin: number; valueCheck: ReconcileValueCheck },
  ) {
    const skipped = new Map<string, ReconcileSkip>();
    const services = new Map<string, DomainService>();
    const unreferenced = new Map<string, ReconcileUnreferenced>();
    let detached = 0;
    let stopped = false;

    const countUnreferenced = (entry: Omit<ReconcileUnreferenced, "count">, count: number) => {
      const key = [entry.recordType, entry.recordField, entry.reason, entry.action].join("\u0000");
      const current = unreferenced.get(key);
      if (current) current.count += count;
      else unreferenced.set(key, { ...entry, count });
    };

    /** 上限に達していれば照合を止めて true */
    const reachedLimit = (recordType: string) => {
      if (detached < limits.maxDetachPerRun) return false;
      stopped = true;
      skip(recordType, "detach_limit", `1 回の上限 ${limits.maxDetachPerRun} 件に達しました`);
      return true;
    };

    const skip = (recordType: string, reason: ReconcileSkipReason, detail?: string) => {
      if (skipped.has(recordType)) return;
      const entry: ReconcileSkip = detail === undefined ? { recordType, reason } : { recordType, reason, detail };
      skipped.set(recordType, entry);
      console.warn(`[storage-sweep] 照合: record_type "${recordType}" を消さずに飛ばしました（${reason}${detail ? `: ${detail}` : ""}）`);
    };

    /** found のサービスだけを返す。引けなければ skip に積んで null */
    async function serviceFor(recordType: string): Promise<DomainService | null> {
      if (skipped.has(recordType)) return null;
      const cached = services.get(recordType);
      if (cached) return cached;
      const found = await lookupService(recordType, { require: ["searchWithDeleted"] });
      if (found.status === "found") {
        services.set(recordType, found.service);
        return found.service;
      }
      skip(
        recordType,
        found.status,
        found.status === "load_failed"
          ? String(found.error instanceof Error ? found.error.message : found.error)
          : found.status === "unsupported"
            ? found.missing.join(",")
            : undefined,
      );
      return null;
    }

    /** 1 つの record_type の束を照合する。全部を処理できたら true（上限で止まったら false） */
    async function reconcileType(recordType: string, refs: AttachedObjectRef[]): Promise<boolean> {
      const domainService = await serviceFor(recordType);
      if (!domainService?.searchWithDeleted) return true;
      const recordIds = [...new Set(refs.map((r) => r.recordId))];
      // 既定の limit（100）で取りこぼさないよう、束の ID 数を渡す
      const found = (await domainService.searchWithDeleted({
        where: { field: CRUD_ID_FIELD, op: "in", value: recordIds },
        limit: recordIds.length,
      })) as { results: Array<Record<string, unknown>> };
      const existing = new Map(found.results.map((row) => [String(row[CRUD_ID_FIELD]), row]));
      const missing = recordIds.filter((id) => !existing.has(id));
      if (missing.length > 0 && existing.size === 0 && recordIds.length >= limits.massMissingMin) {
        skip(recordType, "mass_missing", `${recordIds.length} 件の ID が 1 件も見つかりません`);
        return true;
      }
      for (const recordId of missing) {
        if (reachedLimit(recordType)) return false;
        const ids = refs.filter((r) => r.recordId === recordId).map((r) => r.id);
        // ready・紐付け一致の条件付き更新。並行する置換・付け替えが先に進めていれば外れる
        const rows = await ledger.detach({ ids, recordType, recordId, reason: "record_removed", at: now() });
        for (const row of rows) {
          await service.cleanupDeletedObject(row.id);
          detached += 1;
        }
      }
      if (limits.valueCheck === "off") return true;
      return checkValues(recordType, refs, existing);
    }

    /** 行がある紐付けの値の検査。列ごとに、値に ref が無いものを報告するか外す。全部を処理できたら true */
    async function checkValues(
      recordType: string,
      refs: AttachedObjectRef[],
      existing: Map<string, Record<string, unknown>>,
    ): Promise<boolean> {
      const byField = new Map<string, { checked: number; columnMissing: AttachedObjectRef[]; valueMissing: AttachedObjectRef[] }>();
      for (const ref of refs) {
        const row = existing.get(ref.recordId);
        if (!row || ref.recordField === null) continue;
        const group = byField.get(ref.recordField) ?? { checked: 0, columnMissing: [], valueMissing: [] };
        group.checked += 1;
        if (!Object.hasOwn(row, ref.recordField)) group.columnMissing.push(ref);
        else if (!holdsLedgerRef(row[ref.recordField], ref.id)) group.valueMissing.push(ref);
        byField.set(ref.recordField, group);
      }
      for (const [recordField, group] of byField) {
        // 列はあるのに束の値が 1 件も入っていない = 読み出しの取り違えを疑う（列そのものが無い場合は使わない）
        const held = group.valueMissing.length === group.checked && group.checked >= limits.massMissingMin;
        const plans: Array<["column_missing" | "value_missing", AttachedObjectRef[], boolean]> = [
          ["column_missing", group.columnMissing, false],
          ["value_missing", group.valueMissing, held],
        ];
        for (const [reason, targets, isHeld] of plans) {
          if (targets.length === 0) continue;
          if (limits.valueCheck === "report" || isHeld) {
            countUnreferenced({ recordType, recordField, reason, action: isHeld ? "held" : "reported" }, targets.length);
            continue;
          }
          for (const ref of targets) {
            if (reachedLimit(recordType)) return false;
            // ready・紐付け（行と列）一致の条件付き更新。並行して置換・別の行や列へ付け替えた行は外れない
            const rows = await ledger.detach({
              ids: [ref.id],
              recordType,
              recordId: ref.recordId,
              recordField,
              reason: "unreferenced",
              at: now(),
            });
            for (const row of rows) {
              await service.cleanupDeletedObject(row.id);
              detached += 1;
              countUnreferenced({ recordType, recordField, reason, action: "detached" }, 1);
            }
          }
        }
      }
      return true;
    }

    const startAfter = await reconcileCursor.get();
    const run = await runBudgetedBatches<AttachedObjectRef, string>({
      deadline,
      fetchNext: async (cursor) => {
        if (stopped) return null;
        const rows = await ledger.listAttached({ afterId: cursor ?? startAfter, limit: chunkSize });
        return rows.length > 0
          ? { items: rows, cursor: rows[rows.length - 1].id, done: rows.length < chunkSize }
          : null;
      },
      processChunk: async (rows, progress) => {
        const byType = new Map<string, AttachedObjectRef[]>();
        for (const row of rows) {
          const list = byType.get(row.recordType) ?? [];
          list.push(row);
          byType.set(row.recordType, list);
        }
        for (const [recordType, refs] of byType) {
          if (!(await reconcileType(recordType, refs))) return;
        }
        // 束を最後まで調べたときだけ進める（上限で止まった束は次回もう一度見る）
        await reconcileCursor.advance(progress.cursor);
      },
    });
    // 最後まで行ったら先頭に戻す（次回から新しい一巡）
    if (run.exhausted && !stopped) await reconcileCursor.reset();
    for (const entry of unreferenced.values()) {
      if (entry.action === "detached") continue;
      console.warn(
        `[storage-sweep] 照合: ${entry.recordType}.${entry.recordField} の値に入っていない紐付けが ${entry.count} 件あります` +
          `（${entry.reason}、${entry.action === "held" ? "大量一致のため消していません" : "報告だけ。消すには valueCheck を \"detach\" に"}）`,
      );
    }
    return {
      processed: run.processed,
      exhausted: run.exhausted && !stopped,
      budgetExhausted: run.budgetExhausted,
      reconcile: { detached, skipped: [...skipped.values()], unreferenced: [...unreferenced.values()] },
    };
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

      result.orphanedAttached = { processed: 0, exhausted: false };
      result.reconcile = { detached: 0, skipped: [], unreferenced: [] };
      if (!result.budgetExhausted) {
        const reconciled = await reconcile(deadline, chunkSize, {
          maxDetachPerRun: options.maxDetachPerRun ?? STORAGE_CONFIG.sweep.reconcile.maxDetachPerRun,
          massMissingMin: options.massMissingMin ?? STORAGE_CONFIG.sweep.reconcile.massMissingMin,
          valueCheck: options.valueCheck ?? STORAGE_CONFIG.sweep.reconcile.valueCheck,
        });
        result.orphanedAttached = { processed: reconciled.processed, exhausted: reconciled.exhausted };
        result.reconcile = reconciled.reconcile;
        if (reconciled.budgetExhausted) result.budgetExhausted = true;
      }
      return result;
    },
  };
}

export type StorageSweep = ReturnType<typeof createStorageSweep>;

/** 既定の依存（lookupService 以外）。lookupService は登録表に結ぶ側（cron の task.ts）が src/wiring/domains.ts から渡す */
export const defaultStorageSweepDeps: Omit<StorageSweepDeps, "lookupService"> = {
  ledger: drizzleLedger,
  service: storageObjectService,
  purposes: getStoragePurposes,
  now: () => new Date(),
  reconcileCursor: checkpointReconcileCursor,
};

/** cron storage-sweep から呼ぶ（lookupService = src/wiring/domains.ts の lookupDomainService） */
export function runStorageSweep(
  deps: Pick<StorageSweepDeps, "lookupService">,
  options?: StorageSweepOptions,
): Promise<StorageSweepResult> {
  return createStorageSweep({ ...defaultStorageSweepDeps, ...deps }).run(options);
}
