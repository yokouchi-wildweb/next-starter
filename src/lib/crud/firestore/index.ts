// src/lib/crud/firestore/index.ts

import { getServerFirestore } from "@/lib/firebase/server/app";
import { uuidv7 } from "uuidv7";
import type { ZodType } from "zod";
import { normalizeUndefinedToNull, omitUndefined } from "../utils";
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

  const parseWithSchema = <U>(schema: ZodType<U> | undefined, value: unknown): U | undefined => {
    if (!schema) return undefined;
    const result = schema.safeParse(value);
    if (!result.success) {
      throw result.error;
    }
    return result.data;
  };

  return {
    async create(data: Insert): Promise<Select> {
      const { id: providedId, ...rest } = data as Record<string, any>;
      const parsed = parseWithSchema(options.schemas?.create, rest);
      const insertData = { ...(parsed ?? rest) } as Record<string, any>;
      if (providedId !== undefined) {
        insertData.id = providedId;
      }
      if (options.useCreatedAt && insertData.createdAt === undefined) {
        insertData.createdAt = new Date();
      }
      if (options.useUpdatedAt && insertData.updatedAt === undefined) {
        insertData.updatedAt = new Date();
      }
      let docRef: FirebaseFirestore.DocumentReference;
      if (options.idType === "uuid") {
        insertData.id = uuidv7();
        docRef = col.doc(insertData.id);
      } else if (options.idType === "manual") {
        docRef = col.doc(String((data as any).id));
      } else {
        docRef = col.doc();
        insertData.id = docRef.id;
      }
      await docRef.set(normalizeUndefinedToNull(insertData));
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
      const { id: _ignored, ...rest } = data as Record<string, any>;
      void _ignored;
      const parsed = parseWithSchema(options.schemas?.update, rest);
      const sanitized = { ...omitUndefined(parsed ?? rest) } as Record<string, any>;
      if (options.useUpdatedAt && sanitized.updatedAt === undefined) {
        sanitized.updatedAt = new Date();
      }
      await ref.set(normalizeUndefinedToNull(sanitized), { merge: true });
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
      const { id: providedId, ...rest } = data as Record<string, any>;
      const parsed = parseWithSchema(options.schemas?.upsert ?? options.schemas?.create, rest);
      const insertData = { ...(parsed ?? rest) } as Record<string, any>;
      if (providedId !== undefined) {
        insertData.id = providedId;
      }
      if (options.useCreatedAt && insertData.createdAt === undefined) {
        insertData.createdAt = new Date();
      }
      if (options.useUpdatedAt && insertData.updatedAt === undefined) {
        insertData.updatedAt = new Date();
      }
      const id = insertData.id ?? uuidv7();
      insertData.id = id;
      const ref = col.doc(String(id));
      const sanitizedInsert = omitUndefined(insertData);
      await ref.set(normalizeUndefinedToNull(sanitizedInsert), { merge: true });
      const snap = await ref.get();
      return { id: ref.id, ...(snap.data() as T) } as Select;
    },
  };
}
