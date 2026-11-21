// src/lib/crud/firestore/write.ts
// 1 件の書き込みの群: create / update / delete / restore / hardDelete

import { omitUndefined } from "../utils/object";
import { uuidv7 } from "uuidv7";
import type { FirestoreContext } from "./context";
import { convertTimestamps } from "./timestamps";

export function createFirestoreWriteMethods<T extends { id?: string; createdAt?: any; updatedAt?: any; deletedAt?: any }, TCreate extends Record<string, any>>(ctx: FirestoreContext<T, TCreate>) {
  type Select = T;
  type Insert = TCreate;
  const { options, getCol, useSoftDelete, withLiveDeletedAt } = ctx;
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
        docRef = getCol().doc(String(insertData.id));
      } else if (insertData.id) {
        docRef = getCol().doc(String(insertData.id));
      } else {
        docRef = getCol().doc();
        insertData.id = docRef.id;
      }

      if (options.useCreatedAt && insertData.createdAt === undefined) {
        insertData.createdAt = new Date();
      }
      if (options.useUpdatedAt && insertData.updatedAt === undefined) {
        insertData.updatedAt = new Date();
      }

      const finalInsert = withLiveDeletedAt(omitUndefined(insertData));
      await docRef.set(finalInsert);
      // serverTimestamp() 未使用のため読み戻し不要 — 入力値をそのまま返却
      return convertTimestamps({ id: docRef.id, ...finalInsert } as unknown as Select);
    },
    async update(id: string, data: Partial<Insert>): Promise<Select> {
      const ref = getCol().doc(id);
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
    async delete(id: string): Promise<void> {
      if (useSoftDelete) {
        // ソフトデリート: deletedAt を現在時刻に設定
        await getCol().doc(id).set({ deletedAt: new Date() }, { merge: true });
      } else {
        await getCol().doc(id).delete();
      }
    },
    async restore(id: string): Promise<Select> {
      if (!useSoftDelete) {
        throw new Error("restore() is only available when useSoftDelete is enabled.");
      }
      const ref = getCol().doc(id);
      await ref.set({ deletedAt: null }, { merge: true });
      const snap = await ref.get();
      if (!snap.exists) {
        throw new Error(`Record not found: ${id}`);
      }
      return convertTimestamps({ id: snap.id, ...(snap.data() as T) } as Select);
    },
    async hardDelete(id: string): Promise<void> {
      await getCol().doc(id).delete();
    },
  };
}
