// src/features/core/user/services/server/finders/findUserById.ts

import type { User } from "@/features/core/user/entities";
import { base } from "../drizzleBase";

/**
 * ID でユーザーを取得する低レベルファインダー。
 *
 * - 論理削除済み (deleted_at IS NOT NULL) のレコードは返さない。
 * - userService 経由ではなく drizzleBase を直接参照しているため、wrappers レイヤーと
 *   循環依存を起こさずに低層 (例: auth ドメインのセッション解決) からも利用できる。
 */
export async function findUserById(id: string): Promise<User | null> {
  const user = await base.get(id);
  return user ?? null;
}
