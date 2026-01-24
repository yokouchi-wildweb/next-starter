// src/lib/crud/firestore/index.ts

import { getServerFirestore } from "@/lib/firebase/server/app";
import { omitUndefined } from "@/utils/object";
import { uuidv7 } from "uuidv7";
import { Timestamp } from "firebase-admin/firestore";
import type {
  SearchParams,
  CreateCrudServiceOptions,
  PaginatedResult,
  UpsertOptions,
  BulkUpsertOptions,
  BulkUpsertResult,
  BulkUpdateRecord,
  BulkUpdateResult,
  WhereExpr,
} from "../types";
import { buildSearchQuery, applyWhere } from "./query";

/**
 * FirestoreのTimestampオブジェクトをDateオブジェクトに再帰的に変換する
 * Server Components -> Client Componentsへのシリアライズを可能にする
 */
function convertTimestamps<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (data instanceof Timestamp) return data.toDate() as T;
  if (Array.isArray(data)) return data.map(convertTimestamps) as T;
  if (typeof data === "object") {
    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>).map(([k, v]) => [k, convertTimestamps(v)])
    ) as T;
  }
  return data;
}

export type DefaultInsert<T> = Omit<T, "id" | "createdAt" | "updatedAt">;

/**
 * Create a CRUD service for the given Firestore collection.
 * The interface mirrors `createCrudService` for Drizzle but
 * search and pagination are intentionally simplified.
 */
export function createCrudService<
  T extends { id?: string; createdAt?: any; updatedAt?: any; deletedAt?: any },
  TCreate extends Record<string, any> = DefaultInsert<T>,
>(collectionPath: string, options: CreateCrudServiceOptions<TCreate> = {}) {
  const firestore = getServerFirestore();
  const col = firestore.collection(collectionPath);
  type Select = T;
  type Insert = TCreate;
  const useSoftDelete = options.useSoftDelete ?? false;

  return {
    async create(data: Insert): Promise<Select> {
      const parsedInput = options.parseCreate ? await options.parseCreate(data) : data;
      const insertData = {
        ...parsedInput,
      } as Insert & Record<string, any> & { id?: string; createdAt?: Date; updatedAt?: Date };

      if (options.idType === "uuid") {
        if (insertData.id === undefined) {
          insertData.id = uuidv7();
        }
      }

      let docRef: FirebaseFirestore.DocumentReference;
      if (options.idType === "manual" && insertData.id !== undefined) {
        docRef = col.doc(String(insertData.id));
      } else if (insertData.id) {
        docRef = col.doc(String(insertData.id));
      } else {
        docRef = col.doc();
        insertData.id = docRef.id;
      }

      if (options.useCreatedAt && insertData.createdAt === undefined) {
        insertData.createdAt = new Date();
      }
      if (options.useUpdatedAt && insertData.updatedAt === undefined) {
        insertData.updatedAt = new Date();
      }

      const finalInsert = omitUndefined(insertData);
      await docRef.set(finalInsert);
      const snap = await docRef.get();
      return convertTimestamps({ id: docRef.id, ...(snap.data() as T) } as Select);
    },

    async list(): Promise<Select[]> {
      let query: FirebaseFirestore.Query = col;
      if (useSoftDelete) {
        query = query.where("deletedAt", "==", null);
      }
      const snap = await query.get();
      return snap.docs.map((d) => convertTimestamps({ id: d.id, ...(d.data() as T) } as Select));
    },

    async listWithDeleted(): Promise<Select[]> {
      const snap = await col.get();
      return snap.docs.map((d) => convertTimestamps({ id: d.id, ...(d.data() as T) } as Select));
    },

    async get(id: string): Promise<Select | undefined> {
      const snap = await col.doc(id).get();
      if (!snap.exists) return undefined;
      const data = snap.data() as T;
      // ソフトデリート時は削除済みを除外
      if (useSoftDelete && data.deletedAt != null) {
        return undefined;
      }
      return convertTimestamps({ id: snap.id, ...data } as Select);
    },

    async getWithDeleted(id: string): Promise<Select | undefined> {
      const snap = await col.doc(id).get();
      if (!snap.exists) return undefined;
      return convertTimestamps({ id: snap.id, ...(snap.data() as T) } as Select);
    },

    async update(id: string, data: Partial<Insert>): Promise<Select> {
      const ref = col.doc(id);
      const parsed = options.parseUpdate ? await options.parseUpdate(data) : data;
      const updateData = {
        ...omitUndefined(parsed as Record<string, any>),
      } as Partial<Insert> & Record<string, any> & { updatedAt?: Date };

      if (options.useUpdatedAt && updateData.updatedAt === undefined) {
        updateData.updatedAt = new Date();
      }

      await ref.set(updateData, { merge: true });
      const snap = await ref.get();
      return convertTimestamps({ id: ref.id, ...(snap.data() as T) } as Select);
    },

    async remove(id: string): Promise<void> {
      if (useSoftDelete) {
        // ソフトデリート: deletedAt を現在時刻に設定
        await col.doc(id).set({ deletedAt: new Date() }, { merge: true });
      } else {
        await col.doc(id).delete();
      }
    },

    async restore(id: string): Promise<Select> {
      if (!useSoftDelete) {
        throw new Error("restore() is only available when useSoftDelete is enabled.");
      }
      const ref = col.doc(id);
      await ref.set({ deletedAt: null }, { merge: true });
      const snap = await ref.get();
      if (!snap.exists) {
        throw new Error(`Record not found: ${id}`);
      }
      return convertTimestamps({ id: snap.id, ...(snap.data() as T) } as Select);
    },

    async hardDelete(id: string): Promise<void> {
      await col.doc(id).delete();
    },

    /**
     * Simple equality-based search. `where` is treated as field-value pairs.
     * Only the provided keys are matched. Sorting is limited to a single field.
     * The query fetches up to `page * limit` documents before slicing, so the
     * returned `total` represents the number of fetched documents (not the
     * absolute match count).
     */
    async search(params: SearchParams = {}): Promise<PaginatedResult<Select>> {
      const { page = 1, limit = 100 } = params;
      let q = buildSearchQuery(col, params, options);
      if (useSoftDelete) {
        q = q.where("deletedAt", "==", null);
      }
      const snap = await q.get();
      const docs = snap.docs;
      const total = docs.length;
      const start = (page - 1) * limit;
      const results = docs
        .slice(start, start + limit)
        .map((d) => convertTimestamps({ id: d.id, ...(d.data() as T) } as Select));
      return { results, total };
    },

    async searchWithDeleted(params: SearchParams = {}): Promise<PaginatedResult<Select>> {
      const { page = 1, limit = 100 } = params;
      const q = buildSearchQuery(col, params, options);
      const snap = await q.get();
      const docs = snap.docs;
      const total = docs.length;
      const start = (page - 1) * limit;
      const results = docs
        .slice(start, start + limit)
        .map((d) => convertTimestamps({ id: d.id, ...(d.data() as T) } as Select));
      return { results, total };
    },

    async bulkDeleteByIds(ids: string[]): Promise<void> {
      const batch = firestore.batch();
      if (useSoftDelete) {
        // ソフトデリート
        ids.forEach((id) => batch.set(col.doc(id), { deletedAt: new Date() }, { merge: true }));
      } else {
        ids.forEach((id) => batch.delete(col.doc(id)));
      }
      await batch.commit();
    },

    async bulkDeleteByQuery(where: WhereExpr): Promise<void> {
      if (!where) {
        throw new Error("bulkDeleteByQuery requires a where condition.");
      }
      const query = applyWhere(col, where);
      const snap = await query.get();
      if (snap.empty) return;

      const batch = firestore.batch();
      if (useSoftDelete) {
        // ソフトデリート
        snap.docs.forEach((doc) => batch.set(doc.ref, { deletedAt: new Date() }, { merge: true }));
      } else {
        snap.docs.forEach((doc) => batch.delete(doc.ref));
      }
      await batch.commit();
    },

    async bulkHardDeleteByIds(ids: string[]): Promise<void> {
      const batch = firestore.batch();
      ids.forEach((id) => batch.delete(col.doc(id)));
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

      const ref = col.doc(String(id));
      const sanitizedInsert = omitUndefined(insertData);
      await ref.set(sanitizedInsert, { merge: true });
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
        const batch = firestore.batch();
        const refs: FirebaseFirestore.DocumentReference[] = [];

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

          const ref = col.doc(String(id));
          const sanitizedInsert = omitUndefined(insertData);
          batch.set(ref, sanitizedInsert, { merge: true });
          refs.push(ref);
        }

        await batch.commit();

        // 結果を取得
        for (const ref of refs) {
          const snap = await ref.get();
          results.push(convertTimestamps({ id: ref.id, ...(snap.data() as T) } as Select));
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

      // 存在するレコードを確認
      const existingDocs = await Promise.all(ids.map((id) => col.doc(id).get()));
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
        const batch = firestore.batch();
        const refs: FirebaseFirestore.DocumentReference[] = [];

        for (const record of chunk) {
          const parsedInput = options.parseUpdate
            ? await options.parseUpdate(record.data)
            : record.data;

          const updateData = omitUndefined({
            ...parsedInput,
            ...(options.useUpdatedAt && { updatedAt: new Date() }),
          }) as FirebaseFirestore.UpdateData<T>;

          const ref = col.doc(record.id);
          batch.update(ref, updateData);
          refs.push(ref);
        }

        await batch.commit();

        // 結果を取得
        for (const ref of refs) {
          const snap = await ref.get();
          results.push(convertTimestamps({ id: ref.id, ...(snap.data() as T) } as Select));
        }
      }

      return { results, count: results.length, notFoundIds };
    },

    async duplicate(id: string): Promise<Select> {
      const record = await this.get(id);
      if (!record) {
        throw new Error(`Record not found: ${id}`);
      }

      const {
        id: _id,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        deletedAt: _deletedAt,
        ...rest
      } = record as Select & { id: unknown; createdAt?: unknown; updatedAt?: unknown; deletedAt?: unknown };

      const newData = rest as Record<string, unknown>;
      if (typeof newData.name === "string") {
        newData.name = `${newData.name}_コピー`;
      }

      return this.create(newData as unknown as Insert);
    },
  };
}
