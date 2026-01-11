// src/features/core/user/services/server/setStatusWithdrawn.ts

import { UserTable } from "@/features/core/user/entities/drizzle";
import type { DbTransaction } from "@/lib/crud/drizzle/types";
import { eq } from "drizzle-orm";

/**
 * ユーザーのステータスを「退会済み（withdrawn）」に変更する
 * ソフトデリート時のクリーンナップ処理として使用
 */
export async function setStatusWithdrawn(userId: string, tx: DbTransaction): Promise<void> {
  await tx.update(UserTable).set({ status: "withdrawn" }).where(eq(UserTable.id, userId));
}
