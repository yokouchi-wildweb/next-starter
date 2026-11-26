// src/domains/user/services/server/wrappers/restore.ts

import { eq } from "drizzle-orm";

import { userConfig } from "@/domains/user/config";
import type { User } from "@/domains/core/user/entities";
import { UserTable } from "@/domains/core/user/entities/drizzle";
import { db } from "@/lib/drizzle";
import { userBase } from "../userBase";
import {
  findAvailableSuffixedUserName,
  isUserNameTaken,
  lockUserName,
} from "../helpers/nameAvailability";

/**
 * ソフトデリート済みユーザーの復元 (汎用 /api/user/[id]/restore 経由)。
 *
 * 表示名の一意性が有効な場合、退会中に別ユーザーが同じ表示名を取得している可能性がある。
 * その場合は復元をブロックせず、サフィックス付き表示名 ("名前_2" 等) に付け替えて復元する
 * (付け替えは base.update 経由なので audit_logs に name の変更として記録される)。
 */
export async function restore(id: string): Promise<User> {
  if (!userConfig.name.unique.enabled) {
    return userBase.restore(id);
  }

  const [current] = await db
    .select({ name: UserTable.name, isDemo: UserTable.isDemo })
    .from(UserTable)
    .where(eq(UserTable.id, id))
    .limit(1);

  const name = current?.name?.trim();

  // 名前なし・デモユーザーは占有判定の対象外なのでそのまま復元
  if (!current || !name || current.isDemo) {
    return userBase.restore(id);
  }

  return db.transaction(async (tx) => {
    // 同名の同時書き込みと直列化 (withUserNameGuard と同じロックキー)
    await lockUserName(tx, name);

    const restored = await userBase.restore(id, tx);

    if (!(await isUserNameTaken(name, { excludeUserId: id, executor: tx }))) {
      return restored;
    }

    // サフィックス候補もロックしてから判定する (同じ候補を取りに来た同時書き込みとの重複を防ぐ)
    const fallback = await findAvailableSuffixedUserName(name, {
      executor: tx,
      lockCandidates: true,
    });
    return userBase.update(id, { name: fallback } as Parameters<typeof userBase.update>[1], tx);
  });
}
