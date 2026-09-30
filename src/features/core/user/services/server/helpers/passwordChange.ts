// src/features/core/user/services/server/helpers/passwordChange.ts
//
// 管理者/本人による「パスワード設定」要求 (newPassword) を、
// 認証プロバイダーごとの書き込み先へ振り分ける純粋ロジック。
//
// newPassword はプロバイダー非依存の契約 (「このユーザーのパスワードをこれにする」)。
// UI はプロバイダーごとの保存先を知らないため、写像はサーバー側で行う。
//   - local : users.local_password (スキーマの hash 変換を通す)
//   - email : Firebase Auth の updateUser({ password })
//   - その他: パスワード概念が無いため 400 (無言成功を禁止)
//
// 履歴: 4a8e1393 で編集フォームを認証タブに分離した際、モーダルが newPassword を
// 送るようになったのに local への写像が無く、local ユーザーのパスワード変更が
// 成功トースト付きの no-op になっていた (upstream-request
// 20260930-151349-fix-admin-local-password-change-noop)。

import { DomainError } from "@/lib/errors/domainError";
import type { UserProviderType } from "@/features/core/user/types";

export type PasswordChangePlan = {
  /** local ユーザー向け。スキーマ入力に localPassword としてマージする平文 */
  localPassword?: string;
  /** Firebase email ユーザー向け。Firebase Auth に同期する平文 */
  firebasePassword?: string;
};

export type PlanPasswordChangeInput = {
  providerType: UserProviderType;
  newPassword?: string | null;
};

/**
 * newPassword を正規化 (trim) し、プロバイダー種別に応じた書き込み先を決める。
 * newPassword が未指定/空文字の場合は何もしない (空プラン)。
 * パスワード経路を持たないプロバイダーに newPassword が指定された場合は DomainError 400。
 */
export function planPasswordChange({
  providerType,
  newPassword,
}: PlanPasswordChangeInput): PasswordChangePlan {
  const normalized = typeof newPassword === "string" ? newPassword.trim() : "";
  if (normalized.length === 0) {
    return {};
  }

  switch (providerType) {
    case "local":
      return { localPassword: normalized };
    case "email":
      return { firebasePassword: normalized };
    default:
      throw new DomainError(
        "このユーザーの認証方式ではパスワードを変更できません",
        { status: 400 },
      );
  }
}
