// src/lib/drizzle/transaction.ts

import { db } from "./index";

/**
 * トランザクションクライアントの型
 * db.transaction() のコールバック引数の型を抽出
 */
export type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * トランザクション実行ユーティリティ
 * tx が渡されればそのまま使用し、なければ新規トランザクションを開始
 */
export async function runWithTransaction<T>(
  tx: TransactionClient | undefined,
  handler: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  if (tx) {
    return handler(tx);
  }
  return db.transaction(async (innerTx) => handler(innerTx));
}
