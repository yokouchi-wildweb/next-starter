// src/lib/crud/firestore/index.ts

import { getServerFirestore } from "@/lib/firebase/server/app";
import { omitUndefined } from "@/utils/object";
import { uuidv7 } from "uuidv7";
import type {
  SearchParams,
  CreateCrudServiceOptions,
  PaginatedResult,
  UpsertOptions,
} from "../types";
import { buildSearchQuery } from "./query";

export type DefaultInsert<T> = Omit<T, "id" | "createdAt" | "updatedAt">;

/**
 * Create a CRUD service for the given Firestore collection.
 * The interface mirrors `createCrudService` for Drizzle but
 * search and pagination are intentionally simplified.
 */
export function createCrudService<
  T extends { id?: string; createdAt?: any; updatedAt?: any },
  TCreate extends Record<string, any> = DefaultInsert<T>,
>(collectionPath: string, options: CreateCrudServiceOptions<TCreate> = {}) {
  const firestore = getServerFirestore();
  const col = firestore.collection(collectionPath);
  type Select = T;
  type Insert = TCreate;

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
      return { id: docRef.id, ...(snap.data() as T) } as Select;
    },

    async list(): Promise<Select[]> {
      const snap = await col.get();
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) } as Select));
    },

    async get(id: string): Promise<Select | undefined> {
      const snap = await col.doc(id).get();
      if (!snap.exists) return undefined;
      return { id: snap.id, ...(snap.data() as T) } as Select;
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
      return { id: ref.id, ...(snap.data() as T) } as Select;
    },

    async remove(id: string): Promise<void> {
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
      const q = buildSearchQuery(col, params, options);
      const snap = await q.get();
      const docs = snap.docs;
      const total = docs.length;
      const start = (page - 1) * limit;
      const results = docs
        .slice(start, start + limit)
        .map((d) => ({ id: d.id, ...(d.data() as T) } as Select));
      return { results, total };
    },


    async bulkDelete(ids: string[]): Promise<void> {
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
      return { id: ref.id, ...(snap.data() as T) } as Select;
    },
  };
}
