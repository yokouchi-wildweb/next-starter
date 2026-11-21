// src/lib/crud/firestore/bulk.ts
// 一括と取り込みの群: bulkDeleteBy* / bulkHardDeleteByIds / upsert / bulkUpsert / bulkUpdate

import { omitUndefined } from "../utils/object";
import { uuidv7 } from "uuidv7";
import type { UpsertOptions, BulkUpsertOptions, BulkUpsertResult, BulkUpdateRecord, BulkUpdateResult, WhereExpr } from "../types";
import { applyWhere } from "./query";
import type { FirestoreContext } from "./context";
import { convertTimestamps } from "./timestamps";

export function createFirestoreBulkMethods<T extends { id?: string; createdAt?: any; updatedAt?: any; deletedAt?: any }, TCreate extends Record<string, any>>(ctx: FirestoreContext<T, TCreate>) {
  type Select = T;
  type Insert = TCreate;
  const { options, getDb, getCol, useSoftDelete, writeUpserts } = ctx;
  return {
    async bulkDeleteByIds(ids: string[]): Promise<void> {
      const batch = getDb().batch();
      if (useSoftDelete) {
        // ソフトデリート
        ids.forEach((id) => batch.set(getCol().doc(id), { deletedAt: new Date() }, { merge: true }));
      } else {
        ids.forEach((id) => batch.delete(getCol().doc(id)));
      }
      await batch.commit();
    },
    async bulkDeleteByQuery(where: WhereExpr): Promise<void> {
      if (!where) {
        throw new Error("bulkDeleteByQuery requires a where condition.");
      }
      const query = applyWhere(getCol(), where);
      const snap = await query.get();
      if (snap.empty) return;

      const batch = getDb().batch();
      if (useSoftDelete) {
        // ソフトデリート
        snap.docs.forEach((doc) => batch.set(doc.ref, { deletedAt: new Date() }, { merge: true }));
      } else {
        snap.docs.forEach((doc) => batch.delete(doc.ref));
      }
      await batch.commit();
    },
    async bulkHardDeleteByIds(ids: string[]): Promise<void> {
      const batch = getDb().batch();
      ids.forEach((id) => batch.delete(getCol().doc(id)));
      await batch.commit();
    },
    async upsert(data: Insert & { id?: string }, upsertOptions?: UpsertOptions<Insert>): Promise<Select> {
      void upsertOptions;
      const parsedInput = options.parseUpsert
        ? await options.parseUpsert(data)
        : options.parseCreate
          ? await options.parseCreate(data)
          : data;

      const insertData = { ...parsedInput } as Record<string, any> & {
        id?: string;
        createdAt?: Date;
        updatedAt?: Date;
      };

      const id = insertData.id ?? uuidv7();
      insertData.id = id;

      if (options.useCreatedAt && insertData.createdAt === undefined) {
        insertData.createdAt = new Date();
      }
      if (options.useUpdatedAt && insertData.updatedAt === undefined) {
        insertData.updatedAt = new Date();
      }

      const ref = getCol().doc(String(id));
      const sanitizedInsert = omitUndefined(insertData);
      await writeUpserts([{ ref, data: sanitizedInsert }]);
      const snap = await ref.get();
      return convertTimestamps({ id: ref.id, ...(snap.data() as T) } as Select);
    },
    /**
     * 複数レコードを一括でupsertする。
     * Firestoreのバッチ処理を使用（500件制限あり）。
     */
    async bulkUpsert(
      records: (Insert & { id?: string })[],
      bulkUpsertOptions?: BulkUpsertOptions<Insert>,
    ): Promise<BulkUpsertResult<Select>> {
      // Firestore では conflictFields は使用しない（ID ベースの upsert のみ）
      void bulkUpsertOptions;

      if (records.length === 0) {
        return { results: [], count: 0 };
      }

      // Firestore のバッチは 500 件制限
      const BATCH_SIZE = 500;
      const results: Select[] = [];

      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const chunk = records.slice(i, i + BATCH_SIZE);
        // parse は TX の外で済ませる（TX の関数は競合で再実行されうる）
        const entries: { ref: FirebaseFirestore.DocumentReference; data: Record<string, any> }[] = [];

        for (const data of chunk) {
          const parsedInput = options.parseUpsert
            ? await options.parseUpsert(data)
            : options.parseCreate
              ? await options.parseCreate(data)
              : data;

          const insertData = { ...parsedInput } as Record<string, any> & {
            id?: string;
            createdAt?: Date;
            updatedAt?: Date;
          };

          const id = insertData.id ?? uuidv7();
          insertData.id = id;

          if (options.useCreatedAt && insertData.createdAt === undefined) {
            insertData.createdAt = new Date();
          }
          if (options.useUpdatedAt && insertData.updatedAt === undefined) {
            insertData.updatedAt = new Date();
          }

          const ref = getCol().doc(String(id));
          entries.push({ ref, data: omitUndefined(insertData) });
        }

        await writeUpserts(entries);

        // 結果を一括取得（N回の個別 get → 1回の getAll）
        const snaps = await getDb().getAll(...entries.map((entry) => entry.ref));
        for (const snap of snaps) {
          if (snap.exists) {
            results.push(convertTimestamps({ id: snap.id, ...(snap.data() as T) } as Select));
          }
        }
      }

      return { results, count: results.length };
    },
    /**
     * 複数レコードを一括で更新する。
     * 存在しないIDはスキップされ、notFoundIdsに含まれる。
     */
    async bulkUpdate(
      records: BulkUpdateRecord<Partial<Insert>>[],
    ): Promise<BulkUpdateResult<Select>> {
      if (records.length === 0) {
        return { results: [], count: 0, notFoundIds: [] };
      }

      const ids = records.map((r) => r.id);

      // 存在するレコードを一括確認（N回の個別 get → 1回の getAll）
      const existingDocs = await getDb().getAll(...ids.map((id) => getCol().doc(id)));
      const existingIds = new Set(
        existingDocs.filter((doc) => doc.exists).map((doc) => doc.id)
      );
      const notFoundIds = ids.filter((id) => !existingIds.has(id));

      // 存在するレコードのみ更新
      const validRecords = records.filter((r) => existingIds.has(r.id));
      if (validRecords.length === 0) {
        return { results: [], count: 0, notFoundIds };
      }

      // Firestoreのバッチは500件制限
      const BATCH_SIZE = 500;
      const results: Select[] = [];

      for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
        const chunk = validRecords.slice(i, i + BATCH_SIZE);
        const batch = getDb().batch();
        const refs: FirebaseFirestore.DocumentReference[] = [];

        for (const record of chunk) {
          const parsedInput = options.parseUpdate
            ? await options.parseUpdate(record.data)
            : record.data;

          const updateData = omitUndefined({
            ...parsedInput,
            ...(options.useUpdatedAt && { updatedAt: new Date() }),
          }) as FirebaseFirestore.UpdateData<T>;

          const ref = getCol().doc(record.id);
          batch.update(ref, updateData);
          refs.push(ref);
        }

        await batch.commit();

        // 結果を一括取得（N回の個別 get → 1回の getAll）
        const snaps = await getDb().getAll(...refs);
        for (const snap of snaps) {
          if (snap.exists) {
            results.push(convertTimestamps({ id: snap.id, ...(snap.data() as T) } as Select));
          }
        }
      }

      return { results, count: results.length, notFoundIds };
    },
  };
}
