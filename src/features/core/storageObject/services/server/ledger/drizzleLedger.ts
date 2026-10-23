// src/features/core/storageObject/services/server/ledger/drizzleLedger.ts
//
// StorageLedger の PostgreSQL 実装。

import "server-only";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { getPublicColumns } from "@/lib/crud/drizzle/hiddenColumns";
import { db } from "@/lib/drizzle";
import type { TransactionClient } from "@/lib/drizzle/transaction";

import { StorageObjectTable } from "../../../entities/drizzle";
import type { StorageObject } from "../../../entities/model";
import { findStorageObjectById } from "../finders/findStorageObjectById";
import type { StorageLedger } from "./types";

const T = StorageObjectTable;

function first(rows: unknown[]): StorageObject | null {
  return (rows[0] as StorageObject | undefined) ?? null;
}

export const drizzleLedger: StorageLedger = {
  async insertPendingWithinLimit(row, maxPending, now) {
    return db.transaction(async (tx) => {
      // 同じ利用者・用途の発行を直列にする（TX 終了で自動解放）。
      // READ COMMITTED では「数えてから INSERT」を並行に走らせると両方が上限未満を見てしまうため、
      // 数え上げの前にこの鍵を取る
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`storage_objects:${row.ownerUserId}:${row.purpose}`}, 0))`,
      );
      const inserted = await tx.execute(sql`
        insert into storage_objects
          (id, purpose, status, store, key, owner_user_id, scope_id, declared_size, content_type,
           transfer_kind, expires_at, created_at)
        select ${row.id}, ${row.purpose}, 'pending', ${row.store}, ${row.key}, ${row.ownerUserId},
               ${row.scopeId}, ${row.declaredSize}, ${row.contentType}, ${row.transferKind},
               ${row.expiresAt.toISOString()}, ${row.createdAt.toISOString()}
        where (
          select count(*) from storage_objects
          where owner_user_id = ${row.ownerUserId}
            and purpose = ${row.purpose}
            and (
              status = 'pending'
              or (status = 'deleted' and object_removed_at is null and expires_at > ${now.toISOString()})
            )
        ) < ${maxPending}
        returning id
      `);
      return inserted.length > 0;
    });
  },

  async insertReady(row) {
    await db.insert(T).values({
      id: row.id,
      purpose: row.purpose,
      status: "ready",
      store: row.store,
      key: row.key,
      ownerUserId: row.ownerUserId,
      scopeId: row.scopeId,
      declaredSize: row.size,
      size: row.size,
      contentType: row.contentType,
      generation: row.generation,
      transferKind: "put",
      expiresAt: row.createdAt,
      createdAt: row.createdAt,
      readyAt: row.createdAt,
    });
  },

  findById: findStorageObjectById,

  async setSessionUri(id, sessionUri) {
    await db.update(T).set({ sessionUri }).where(eq(T.id, id));
  },

  async markReady(id, values) {
    const rows = await db
      .update(T)
      .set({
        status: "ready",
        size: values.size,
        contentType: values.contentType,
        generation: values.generation,
        readyAt: values.readyAt,
      })
      .where(and(eq(T.id, id), eq(T.status, "pending")))
      .returning(getPublicColumns(T));
    return first(rows);
  },

  async markDeleted(id, values, condition) {
    const rows = await db
      .update(T)
      .set({ status: "deleted", reason: values.reason, deletedAt: values.at })
      .where(
        and(
          eq(T.id, id),
          inArray(T.status, [...condition.statuses]),
          condition.unattachedOnly ? isNull(T.recordId) : undefined,
          condition.ownerUserId !== undefined ? eq(T.ownerUserId, condition.ownerUserId) : undefined,
        ),
      )
      .returning(getPublicColumns(T));
    return first(rows);
  },

  async markObjectRemoved(id, at) {
    await db.update(T).set({ objectRemovedAt: at }).where(eq(T.id, id));
  },

  async attach(input, tx?: TransactionClient) {
    const executor = tx ?? db;
    const rows = await executor
      .update(T)
      .set({ recordType: input.recordType, recordId: input.recordId, recordField: input.recordField })
      .where(
        and(
          eq(T.id, input.id),
          eq(T.status, "ready"),
          isNull(T.recordId),
          eq(T.purpose, input.purpose),
          eq(T.store, input.store),
          eq(T.key, input.key),
          input.ownerUserId === null ? isNull(T.ownerUserId) : eq(T.ownerUserId, input.ownerUserId),
          input.scopeId !== undefined
            ? input.scopeId === null
              ? isNull(T.scopeId)
              : eq(T.scopeId, input.scopeId)
            : undefined,
        ),
      )
      .returning({ id: T.id });
    return rows.length > 0;
  },

  async detach(input, tx?: TransactionClient) {
    if (input.ids.length === 0) return [];
    const executor = tx ?? db;
    const rows = await executor
      .update(T)
      .set({ status: "deleted", reason: input.reason, deletedAt: input.at })
      .where(
        and(
          inArray(T.id, [...input.ids]),
          eq(T.status, "ready"),
          eq(T.recordType, input.recordType),
          eq(T.recordId, input.recordId),
        ),
      )
      .returning(getPublicColumns(T));
    return rows as StorageObject[];
  },
};
