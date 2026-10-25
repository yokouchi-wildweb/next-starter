// src/features/core/storageObject/services/server/ledger/memoryLedger.ts
//
// StorageLedger のメモリ実装（単体テスト用）。drizzleLedger と同じ条件で行を更新する。
// 各操作は await を挟まず一度に判定と更新をするので、並行に呼んでも一方だけが成功する。
// SQL の原子性そのものは test:storage-object-db（実 DB）で確かめる。

import type { StorageObject } from "../../../entities/model";
import type { StorageLedger } from "./types";

export type MemoryLedger = StorageLedger & {
  readonly rows: ReadonlyMap<string, StorageObject>;
};

export function createMemoryLedger(): MemoryLedger {
  const rows = new Map<string, StorageObject>();

  /** サービス境界の外と同じく session_uri を隠した写しを返す */
  const publicCopy = (row: StorageObject): StorageObject => ({ ...row, sessionUri: null });

  return {
    rows,

    async insertPendingWithinLimit(row, maxPending, now) {
      for (const r of rows.values()) {
        if (
          r.ownerUserId === row.ownerUserId &&
          r.purpose === row.purpose &&
          r.status === "pending" &&
          r.transferKind === "put" &&
          r.expiresAt <= now
        ) {
          Object.assign(r, { status: "deleted", reason: "expired", deletedAt: now });
        }
      }
      const count = [...rows.values()].filter(
        (r) =>
          r.ownerUserId === row.ownerUserId &&
          r.purpose === row.purpose &&
          (r.status === "pending" ||
            (r.status === "deleted" && r.objectRemovedAt === null && r.expiresAt > now)),
      ).length;
      if (count >= maxPending) return false;
      if ([...rows.values()].some((r) => r.store === row.store && r.key === row.key)) {
        throw new Error("duplicate key: storage_objects_store_key_idx");
      }
      rows.set(row.id, {
        ...row,
        status: "pending",
        size: null,
        generation: null,
        sessionUri: null,
        recordType: null,
        recordId: null,
        recordField: null,
        readyAt: null,
        deletedAt: null,
        objectRemovedAt: null,
        reason: null,
      });
      return true;
    },

    async insertReady(row) {
      rows.set(row.id, {
        ...row,
        status: "ready",
        declaredSize: row.size,
        transferKind: "put",
        sessionUri: null,
        recordType: null,
        recordId: null,
        recordField: null,
        expiresAt: row.createdAt,
        readyAt: row.createdAt,
        deletedAt: null,
        objectRemovedAt: null,
        reason: null,
      });
    },

    async listSweepTargets(target, input) {
      const matches = (r: StorageObject) => {
        if (target === "expiredPending") return r.status === "pending" && r.expiresAt <= input.now;
        if (target === "unattachedReady") {
          return (
            r.status === "ready" &&
            r.recordId === null &&
            r.readyAt !== null &&
            r.readyAt <= input.readyBefore &&
            !input.excludePurposes.includes(r.purpose)
          );
        }
        return (
          r.status === "deleted" &&
          r.objectRemovedAt === null &&
          (r.transferKind === "session" || r.expiresAt <= input.now)
        );
      };
      return [...rows.values()]
        .filter((r) => matches(r) && (input.afterId === null || r.id > input.afterId))
        .map((r) => r.id)
        .sort()
        .slice(0, input.limit);
    },

    async findById(id) {
      const row = rows.get(id);
      return row ? { ...row } : null;
    },

    async setSessionUri(id, sessionUri) {
      const row = rows.get(id);
      if (row) row.sessionUri = sessionUri;
    },

    async markReady(id, values) {
      const row = rows.get(id);
      if (!row || row.status !== "pending") return null;
      const { store, key, ...rest } = values;
      if (
        (store !== undefined || key !== undefined) &&
        [...rows.values()].some(
          (r) => r.id !== id && r.store === (store ?? row.store) && r.key === (key ?? row.key),
        )
      ) {
        throw new Error("duplicate key: storage_objects_store_key_idx");
      }
      Object.assign(row, { status: "ready", ...rest }, store !== undefined ? { store } : {}, key !== undefined ? { key } : {});
      return publicCopy(row);
    },

    async markDeleted(id, values, condition) {
      const row = rows.get(id);
      if (!row || !condition.statuses.includes(row.status)) return null;
      if (condition.unattachedOnly && row.recordId !== null) return null;
      if (condition.ownerUserId !== undefined && row.ownerUserId !== condition.ownerUserId) return null;
      if (condition.expiresBefore && row.expiresAt > condition.expiresBefore) return null;
      if (condition.readyBefore && (row.readyAt === null || row.readyAt > condition.readyBefore)) return null;
      Object.assign(row, { status: "deleted", reason: values.reason, deletedAt: values.at });
      return publicCopy(row);
    },

    async markObjectRemoved(id, at) {
      const row = rows.get(id);
      if (row) row.objectRemovedAt = at;
    },

    async attach(input) {
      const row = rows.get(input.id);
      if (
        !row ||
        row.status !== "ready" ||
        row.recordId !== null ||
        row.purpose !== input.purpose ||
        row.store !== input.store ||
        row.key !== input.key ||
        row.ownerUserId !== input.ownerUserId ||
        (input.scopeId !== undefined && row.scopeId !== input.scopeId)
      ) {
        return false;
      }
      Object.assign(row, {
        recordType: input.recordType,
        recordId: input.recordId,
        recordField: input.recordField,
      });
      return true;
    },

    async detach(input) {
      const detached: StorageObject[] = [];
      for (const id of input.ids) {
        const row = rows.get(id);
        if (
          !row ||
          row.status !== "ready" ||
          row.recordType !== input.recordType ||
          row.recordId !== input.recordId
        ) {
          continue;
        }
        Object.assign(row, { status: "deleted", reason: input.reason, deletedAt: input.at });
        detached.push(publicCopy(row));
      }
      return detached;
    },

    async rebind(input) {
      const row = rows.get(input.id);
      if (
        !row ||
        row.status !== "ready" ||
        row.purpose !== input.purpose ||
        row.recordType !== input.recordType ||
        row.recordId !== input.fromRecordId ||
        (input.scopeId !== undefined && row.scopeId !== input.scopeId)
      ) {
        return false;
      }
      Object.assign(row, { recordId: input.toRecordId, recordField: input.recordField });
      return true;
    },
  };
}
