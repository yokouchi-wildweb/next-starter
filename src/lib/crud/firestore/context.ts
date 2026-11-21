// src/lib/crud/firestore/context.ts
// Firestore のサービス 1 つ分の共有の状態と道具(初回に解決する Firestore・論理削除の deletedAt を書く道具)

import { getServerFirestore } from "@/lib/firebase/server";
import type { FirestoreCrudServiceOptions } from "./index";

export function createFirestoreContext<T extends { id?: string; createdAt?: any; updatedAt?: any; deletedAt?: any }, TCreate extends Record<string, any>>(
  collectionPath: string,
  options: FirestoreCrudServiceOptions<TCreate>,
) {
  // Firestore の解決は構築時ではなく初回メソッド呼び出し時に行う（memoize）。
  // createFirestoreCrudService は serviceRegistry 経由で全 API ルートの module 評価時に走るため、
  // 構築時に getServerFirestore() を呼ぶと Firebase 未設定（pnpm ops setup env 直後）で全ルートが落ちる。
  // 設定済み時の挙動は従来と同一（初回アクセスで 1 回だけ初期化）。
  let firestoreRef: FirebaseFirestore.Firestore | undefined;
  const getDb = (): FirebaseFirestore.Firestore => (firestoreRef ??= getServerFirestore());
  const getCol = (): FirebaseFirestore.CollectionReference => getDb().collection(collectionPath);
  const useSoftDelete = options.useSoftDelete ?? false;

  // 論理削除の絞り込みは deletedAt == null で、Firestore はフィールドの無い文書を == null に一致させない。
  // このため作成の経路は deletedAt: null を書く（useSoftDelete のときだけ。入力に値があればそれを使う）
  const withLiveDeletedAt = <D extends Record<string, any>>(data: D): D =>
    useSoftDelete && data.deletedAt === undefined ? { ...data, deletedAt: null } : data;

  /**
   * upsert の書き込み。useSoftDelete のときは同じ TX で今の文書を読み、deletedAt が無い（新規・既存の古い行）
   * ときだけ null を足す。論理削除済みの行は削除のまま（upsert は復元しない。復元は restore）
   */
  const writeUpserts = async (
    entries: { ref: FirebaseFirestore.DocumentReference; data: Record<string, any> }[],
  ): Promise<void> => {
    if (!useSoftDelete) {
      const batch = getDb().batch();
      for (const { ref, data } of entries) batch.set(ref, data, { merge: true });
      await batch.commit();
      return;
    }
    await getDb().runTransaction(async (transaction) => {
      const snaps = await transaction.getAll(...entries.map((entry) => entry.ref));
      entries.forEach(({ ref, data }, index) => {
        const stored = snaps[index].exists ? snaps[index].get("deletedAt") : undefined;
        transaction.set(ref, stored === undefined ? withLiveDeletedAt(data) : data, { merge: true });
      });
    });
  };

  return {
    collectionPath,
    options,
    getDb,
    getCol,
    useSoftDelete,
    withLiveDeletedAt,
    writeUpserts,
  };
}

/** 群(read / write / bulk)が共有する、Firestore のサービス 1 つ分の状態と道具 */
export type FirestoreContext<T extends { id?: string; createdAt?: any; updatedAt?: any; deletedAt?: any }, TCreate extends Record<string, any>> = ReturnType<typeof createFirestoreContext<T, TCreate>>;
