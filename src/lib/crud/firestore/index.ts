// src/lib/crud/firestore/index.ts
// Firestore の CRUD サービス createFirestoreCrudService(機能凍結)の組み立て: 共有の状態(context)と操作の群(read / write / bulk)を 1 つにまとめる

import type { CrudServiceBaseOptions, DuplicateOptions } from "../types";
import { createFirestoreBulkMethods } from "./bulk";
import { createFirestoreContext } from "./context";
import { createFirestoreReadMethods } from "./read";
import { createFirestoreWriteMethods } from "./write";

export type FirestoreDefaultInsert<T> = Partial<Omit<T, "id" | "createdAt" | "updatedAt">>;

/** createFirestoreCrudService のオプション(今は共通の土台そのまま。Firestore だけの鍵はここへ足す) */
export type FirestoreCrudServiceOptions<TData extends Record<string, any> = Record<string, any>> = CrudServiceBaseOptions<TData>;

/**
 * Create a CRUD service for the given Firestore collection.
 * The interface mirrors `createCrudService` for Drizzle but
 * search and pagination are intentionally simplified.
 */
export function createFirestoreCrudService<
  T extends { id?: string; createdAt?: any; updatedAt?: any; deletedAt?: any },
  TCreate extends Record<string, any> = FirestoreDefaultInsert<T>,
>(collectionPath: string, options: FirestoreCrudServiceOptions<TCreate> = {}) {
  type Select = T;
  type Insert = TCreate;
  const ctx = createFirestoreContext<T, TCreate>(collectionPath, options);

  // 群ごとのメソッドを 1 つのサービスにまとめる。duplicate は this で get / create を呼ぶのでここに置く(this = 呼ばれたサービス)
  return {
    ...createFirestoreWriteMethods<T, TCreate>(ctx),
    ...createFirestoreReadMethods<T, TCreate>(ctx),
    ...createFirestoreBulkMethods<T, TCreate>(ctx),
    async duplicate(id: string, options?: DuplicateOptions): Promise<Select> {
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
        newData.name = options?.name ?? `${newData.name}_コピー`;
      }

      return this.create(newData as unknown as Insert);
    },
  };
}
