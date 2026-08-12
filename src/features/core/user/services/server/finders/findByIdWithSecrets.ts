// src/features/user/services/server/finders/findByIdWithSecrets.ts

import { eq } from "drizzle-orm";

import type { User } from "@/features/core/user/entities";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { db } from "@/lib/drizzle";

/**
 * 秘匿カラム（localPassword）を含む生のユーザー行を ID で取得する。
 * 論理削除済みの行も返す（削除判定は呼び出し側が deletedAt で行う）。
 *
 * createCrudService は hiddenColumns 宣言により localPassword を常に null 化するため、
 * パスワード検証などサーバー内部で秘匿値を読む必要がある処理はこのファインダーを使う。
 * 戻り値を HTTP レスポンスに乗せることは厳禁（サービス層内で消費し切ること）。
 */
export async function findByIdWithSecrets(userId: string): Promise<User | null> {
  const user = await db.query.UserTable.findFirst({
    where: eq(UserTable.id, userId),
  });

  return user ?? null;
}
