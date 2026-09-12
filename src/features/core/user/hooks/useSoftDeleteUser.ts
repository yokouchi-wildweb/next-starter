// src/features/core/user/hooks/useSoftDeleteUser.ts

"use client";

import { useDomainMutation } from "@/lib/crud/hooks";
import { normalizeHttpError } from "@/lib/errors";

import { userClient, type SoftDeleteInput } from "../services/client/userClient";

type TriggerArg = {
  userId: string;
  data?: SoftDeleteInput;
};

/**
 * ユーザーをソフトデリートするフック（管理者操作）
 * 並列 trigger 安全（lib/crud/hooks/internal/useDomainMutation に準拠）
 * 成功時: users 一覧・検索キャッシュを再検証
 */
export const useSoftDeleteUser = () =>
  useDomainMutation<void, TriggerArg>(
    "users/soft-delete",
    async (arg) => {
      try {
        return await userClient.softDelete(arg.userId, arg.data);
      } catch (error) {
        throw normalizeHttpError(error, "ユーザーの削除に失敗しました");
      }
    },
    "users",
  );
