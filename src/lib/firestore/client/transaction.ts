// src/lib/firestore/client/transaction.ts
//
// Firestore runTransaction のクライアント用ラッパー。
// read-then-write のアトミック操作を提供する。

import {
  type DocumentReference,
  type SetOptions,
  type Transaction,
  runTransaction,
} from "firebase/firestore";

import { fstore } from "@/lib/firebase/client/app";

import { convertTimestamps } from "./converter";
import { normalizeFirestoreError } from "./errors";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/**
 * トランザクション内で使えるコンテキスト
 *
 * Firebase SDK の Transaction をラップし、
 * get 時に Timestamp 変換を自動適用する。
 */
export type TransactionContext = {
  /** ドキュメントを取得する（Timestamp 変換済み） */
  get: <T extends { id: string }>(ref: DocumentReference) => Promise<T | null>;
  /** ドキュメントを作成または上書きする */
  set: (ref: DocumentReference, data: Record<string, unknown>, options?: SetOptions) => void;
  /** ドキュメントを部分更新する */
  update: (ref: DocumentReference, data: Record<string, unknown>) => void;
  /** ドキュメントを削除する */
  delete: (ref: DocumentReference) => void;
};

// ---------------------------------------------------------------------------
// 公開関数
// ---------------------------------------------------------------------------

/**
 * read-then-write のアトミック操作を実行する
 *
 * @throws {FirestoreClientError} トランザクション失敗時
 *
 * @example
 * ```ts
 * // directルーム作成時の重複チェック
 * const room = await executeTransaction(async (tx) => {
 *   const existing = await tx.get<ChatRoom>(existingRoomRef);
 *   if (existing) return existing;
 *
 *   tx.set(newRoomRef, { participants, participantPair, ... });
 *   return null;
 * });
 * ```
 */
export async function executeTransaction<T>(
  fn: (tx: TransactionContext) => Promise<T>,
): Promise<T> {
  try {
    return await runTransaction(fstore, async (transaction) => {
      const ctx = createTransactionContext(transaction);
      return fn(ctx);
    });
  } catch (error) {
    throw normalizeFirestoreError(error);
  }
}

// ---------------------------------------------------------------------------
// 内部関数
// ---------------------------------------------------------------------------

function createTransactionContext(transaction: Transaction): TransactionContext {
  return {
    get: async <T extends { id: string }>(ref: DocumentReference): Promise<T | null> => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) return null;
      return convertTimestamps({ id: snapshot.id, ...snapshot.data() } as T);
    },
    set: (ref, data, options?) => {
      if (options) {
        transaction.set(ref, data, options);
      } else {
        transaction.set(ref, data);
      }
    },
    update: (ref, data) => {
      transaction.update(ref, data);
    },
    delete: (ref) => {
      transaction.delete(ref);
    },
  };
}
