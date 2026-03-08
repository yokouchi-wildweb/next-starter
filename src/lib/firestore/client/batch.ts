// src/lib/firestore/client/batch.ts
//
// Firestore writeBatch のクライアント用ヘルパー。
// 複数操作のアトミック実行、500件上限の自動チャンク分割を提供する。

import { type DocumentReference, type SetOptions, writeBatch } from "firebase/firestore";

import { fstore } from "@/lib/firebase/client/app";

import { normalizeFirestoreError } from "./errors";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

type SetOperation = {
  type: "set";
  ref: DocumentReference;
  data: Record<string, unknown>;
  options?: SetOptions;
};

type UpdateOperation = {
  type: "update";
  ref: DocumentReference;
  data: Record<string, unknown>;
};

type DeleteOperation = {
  type: "delete";
  ref: DocumentReference;
};

export type BatchOperation = SetOperation | UpdateOperation | DeleteOperation;

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

/** Firestore のバッチ書き込み上限 */
const BATCH_LIMIT = 500;

// ---------------------------------------------------------------------------
// 公開関数
// ---------------------------------------------------------------------------

/**
 * 複数の Firestore 操作をバッチで実行する
 *
 * - 500件以下: 単一バッチでアトミック実行
 * - 500件超:   自動的にチャンク分割して順次実行（チャンク間のアトミック性はない）
 *
 * @throws {FirestoreClientError} 操作失敗時
 *
 * @example
 * ```ts
 * await executeBatch([
 *   { type: "set", ref: messageRef, data: { content, senderId, createdAt: serverTimestamp() } },
 *   { type: "update", ref: roomRef, data: { lastMessageSnapshot: { ... }, updatedAt: serverTimestamp() } },
 * ]);
 * ```
 */
export async function executeBatch(operations: BatchOperation[]): Promise<void> {
  if (operations.length === 0) return;

  try {
    if (operations.length <= BATCH_LIMIT) {
      await commitBatch(operations);
    } else {
      // チャンク分割して順次実行
      for (let i = 0; i < operations.length; i += BATCH_LIMIT) {
        const chunk = operations.slice(i, i + BATCH_LIMIT);
        await commitBatch(chunk);
      }
    }
  } catch (error) {
    throw normalizeFirestoreError(error);
  }
}

// ---------------------------------------------------------------------------
// 内部関数
// ---------------------------------------------------------------------------

function commitBatch(operations: BatchOperation[]): Promise<void> {
  const batch = writeBatch(fstore);

  for (const op of operations) {
    switch (op.type) {
      case "set":
        if (op.options) {
          batch.set(op.ref, op.data, op.options);
        } else {
          batch.set(op.ref, op.data);
        }
        break;
      case "update":
        batch.update(op.ref, op.data);
        break;
      case "delete":
        batch.delete(op.ref);
        break;
    }
  }

  return batch.commit();
}
