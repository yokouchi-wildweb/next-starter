// src/lib/crud/firestore/read.ts
// 読みの群: list / get / count / search と、論理削除済みも含める *WithDeleted

import type { BoundedSearchParams, CountParams, CountResult, PaginatedResult } from "../types";
import { buildSearchQuery } from "./query";
import type { FirestoreContext } from "./context";
import { convertTimestamps } from "./timestamps";

export function createFirestoreReadMethods<T extends { id?: string; createdAt?: any; updatedAt?: any; deletedAt?: any }, TCreate extends Record<string, any>>(ctx: FirestoreContext<T, TCreate>) {
  type Select = T;
  const { options, getCol, useSoftDelete } = ctx;
  return {
    async list(): Promise<Select[]> {
      let query: FirebaseFirestore.Query = getCol();
      if (useSoftDelete) {
        query = query.where("deletedAt", "==", null);
      }
      const snap = await query.get();
      return snap.docs.map((d) => convertTimestamps({ id: d.id, ...(d.data() as T) } as Select));
    },
    async listWithDeleted(): Promise<Select[]> {
      const snap = await getCol().get();
      return snap.docs.map((d) => convertTimestamps({ id: d.id, ...(d.data() as T) } as Select));
    },
    async get(id: string): Promise<Select | undefined> {
      const snap = await getCol().doc(id).get();
      if (!snap.exists) return undefined;
      const data = snap.data() as T;
      // ソフトデリート時は削除済みを除外
      if (useSoftDelete && data.deletedAt != null) {
        return undefined;
      }
      return convertTimestamps({ id: snap.id, ...data } as Select);
    },
    async getWithDeleted(id: string): Promise<Select | undefined> {
      const snap = await getCol().doc(id).get();
      if (!snap.exists) return undefined;
      return convertTimestamps({ id: snap.id, ...(snap.data() as T) } as Select);
    },
    async count(params: CountParams = {}): Promise<CountResult> {
      let q = buildSearchQuery(getCol(), params, options);
      if (useSoftDelete) {
        q = q.where("deletedAt", "==", null);
      }
      const snap = await q.count().get();
      return { total: snap.data().count };
    },
    async countWithDeleted(params: CountParams = {}): Promise<CountResult> {
      const q = buildSearchQuery(getCol(), params, options);
      const snap = await q.count().get();
      return { total: snap.data().count };
    },
    /**
     * Simple equality-based search. `where` is treated as field-value pairs.
     * Only the provided keys are matched. Sorting is limited to a single field.
     * The query fetches up to `page * limit` documents before slicing, so the
     * returned `total` represents the number of fetched documents (not the
     * absolute match count).
     */
    async search(params: BoundedSearchParams): Promise<PaginatedResult<Select>> {
      const { page = 1, limit } = params;
      let q = buildSearchQuery(getCol(), params, options);
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
    async searchWithDeleted(params: BoundedSearchParams): Promise<PaginatedResult<Select>> {
      const { page = 1, limit } = params;
      const q = buildSearchQuery(getCol(), params, options);
      const snap = await q.get();
      const docs = snap.docs;
      const total = docs.length;
      const start = (page - 1) * limit;
      const results = docs
        .slice(start, start + limit)
        .map((d) => convertTimestamps({ id: d.id, ...(d.data() as T) } as Select));
      return { results, total };
    },
  };
}
