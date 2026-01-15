// src/features/core/auth/services/server/verifyCurrentUserPassword.ts

import { verifyPassword } from "@/features/core/auth/utils/password";
import { userService } from "@/features/core/user/services/server/userService";
import { DomainError } from "@/lib/errors";

/**
 * 現在ログイン中のユーザーのパスワードを検証する
 * ローカル認証ユーザーのみ対応
 *
 * @param userId - 検証対象のユーザーID
 * @param password - 検証するパスワード（平文）
 * @returns パスワードが正しければtrue
 * @throws DomainError - ユーザーが存在しない、またはローカル認証でない場合
 */
export async function verifyCurrentUserPassword(
  userId: string,
  password: string,
): Promise<boolean> {
  // ユーザーを取得（論理削除されたユーザーも含む）
  const user = await userService.getWithDeleted(userId);

  if (!user) {
    throw new DomainError(`ユーザーが見つかりません (ID: ${userId})`, { status: 404 });
  }

  // 論理削除されている場合はエラー
  if (user.deletedAt) {
    throw new DomainError("このユーザーは削除されています", { status: 403 });
  }

  // ローカル認証ユーザーでない場合はエラー
  if (user.providerType !== "local" || !user.localPassword) {
    throw new DomainError("このユーザーはパスワード認証に対応していません", {
      status: 400,
    });
  }

  // パスワードを検証
  return verifyPassword(password, user.localPassword);
}
