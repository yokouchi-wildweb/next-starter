// src/features/core/user/hooks/useChangeUserRole.ts

"use client";

import { useDomainMutation } from "@/lib/crud/hooks";
import { normalizeHttpError } from "@/lib/errors";

import { userClient, type ChangeRoleInput } from "../services/client/userClient";
import type { User } from "../entities";

type TriggerArg = {
  userId: string;
  data: ChangeRoleInput;
};

/**
 * ユーザーのロールを変更するフック（管理者操作）
 * 並列 trigger 安全（lib/crud/hooks/internal/useDomainMutation に準拠）
 * 成功時: users 一覧・検索キャッシュを再検証
 */
export const useChangeUserRole = () =>
  useDomainMutation<User, TriggerArg>(
    "users/change-role",
    async (arg) => {
      try {
        return await userClient.changeRole(arg.userId, arg.data);
      } catch (error) {
        throw normalizeHttpError(error, "ロールの変更に失敗しました");
      }
    },
    "users",
  );
