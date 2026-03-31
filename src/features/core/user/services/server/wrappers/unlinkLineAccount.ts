// src/features/user/services/server/wrappers/unlinkLineAccount.ts

import type { User } from "@/features/core/user/entities";
import { base } from "../drizzleBase";
import { DomainError } from "@/lib/errors";

/**
 * ユーザーから LINE 連携を解除する。
 */
export async function unlinkLineAccount(userId: string): Promise<User> {
  const current = await base.get(userId);
  if (!current) {
    throw new DomainError("ユーザーが見つかりません", { status: 404 });
  }

  if (!current.lineUserId) {
    throw new DomainError("LINE 連携されていません", { status: 400 });
  }

  return base.update(userId, {
    lineUserId: null,
    lineDisplayName: null,
    linePictureUrl: null,
  } as Parameters<typeof base.update>[1]);
}
