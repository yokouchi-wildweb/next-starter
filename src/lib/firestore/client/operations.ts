// src/lib/firestore/client/operations.ts
//
// Firestore の単発ドキュメント操作ラッパー。
// Timestamp 変換とエラー正規化を内包し、ドメインの ClientService から利用する。

import {
  type DocumentReference,
  type Query,
  type QueryDocumentSnapshot,
  type SetOptions,
  deleteDoc as firestoreDeleteDoc,
  getDoc as firestoreGetDoc,
  getDocs as firestoreGetDocs,
  setDoc as firestoreSetDoc,
  updateDoc as firestoreUpdateDoc,
} from "firebase/firestore";

import { convertTimestamps } from "./converter";
import { normalizeFirestoreError } from "./errors";

/**
 * 単一ドキュメントを取得する
 *
 * @returns ドキュメントが存在すれば変換済みデータ、なければ null
 * @throws {FirestoreClientError} 取得失敗時
 */
export async function getDoc<T extends { id: string }>(
  ref: DocumentReference,
): Promise<T | null> {
  try {
    const snapshot = await firestoreGetDoc(ref);
    if (!snapshot.exists()) return null;
    return convertTimestamps({ id: snapshot.id, ...snapshot.data() } as T);
  } catch (error) {
    throw normalizeFirestoreError(error);
  }
}

/** queryDocs の戻り値 */
export type QueryResult<T> = {
  /** 変換済みデータの配列 */
  docs: T[];
  /**
   * 最後のドキュメントの生スナップショット。
   * 次回の startAfter() に渡すことで、同一フィールド値のドキュメントが
   * 複数あっても正確にカーソル位置を指定できる。
   * 結果が空の場合は null。
   */
  lastSnapshot: QueryDocumentSnapshot | null;
};

/**
 * Query を実行して複数ドキュメントを1回で取得する
 *
 * カーソルベースのページネーション（startAfter + limit）等に使用する。
 * リアルタイム購読が不要な一括取得に最適。
 *
 * @returns 変換済みデータと最後の DocumentSnapshot（カーソル用）
 * @throws {FirestoreClientError} 取得失敗時
 *
 * @example
 * ```ts
 * // 過去メッセージの読み込み
 * const q = query(
 *   collection(fstore, `chatRooms/${roomId}/messages`),
 *   orderBy("createdAt", "desc"),
 *   startAfter(cursor),  // QueryResult.lastSnapshot を渡す
 *   limit(30),
 * );
 * const { docs, lastSnapshot } = await queryDocs<Message>(q);
 * ```
 */
export async function queryDocs<T extends { id: string }>(
  q: Query,
): Promise<QueryResult<T>> {
  try {
    const snapshot = await firestoreGetDocs(q);
    const docs = snapshot.docs.map((doc) =>
      convertTimestamps({ id: doc.id, ...doc.data() } as T),
    );
    const lastSnapshot = snapshot.docs.length > 0
      ? snapshot.docs[snapshot.docs.length - 1]
      : null;
    return { docs, lastSnapshot };
  } catch (error) {
    throw normalizeFirestoreError(error);
  }
}

/**
 * ドキュメントを作成または上書きする
 *
 * @param ref - ドキュメント参照
 * @param data - 保存するデータ
 * @param options - SetOptions（{ merge: true } 等）
 * @throws {FirestoreClientError} 書き込み失敗時
 */
export async function setDoc(
  ref: DocumentReference,
  data: Record<string, unknown>,
  options?: SetOptions,
): Promise<void> {
  try {
    if (options) {
      await firestoreSetDoc(ref, data, options);
    } else {
      await firestoreSetDoc(ref, data);
    }
  } catch (error) {
    throw normalizeFirestoreError(error);
  }
}

/**
 * ドキュメントを部分更新する
 *
 * @throws {FirestoreClientError} 更新失敗時（ドキュメントが存在しない場合を含む）
 */
export async function updateDoc(
  ref: DocumentReference,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    await firestoreUpdateDoc(ref, data);
  } catch (error) {
    throw normalizeFirestoreError(error);
  }
}

/**
 * ドキュメントを削除する
 *
 * @throws {FirestoreClientError} 削除失敗時
 */
export async function deleteDoc(ref: DocumentReference): Promise<void> {
  try {
    await firestoreDeleteDoc(ref);
  } catch (error) {
    throw normalizeFirestoreError(error);
  }
}
