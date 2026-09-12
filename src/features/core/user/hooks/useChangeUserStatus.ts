// src/features/core/user/hooks/useChangeUserStatus.ts

"use client";

import { useDomainMutation } from "@/lib/crud/hooks";
import { normalizeHttpError } from "@/lib/errors";

import { userClient, type ChangeStatusInput } from "../services/client/userClient";
import type { User } from "../entities";

type TriggerArg = {
  userId: string;
  data: ChangeStatusInput;
};

/**
 * ユーザーのステータスを変更するフック（管理者操作）
 * 並列 trigger 安全（lib/crud/hooks/internal/useDomainMutation に準拠）
 * 成功時: users 一覧・検索キャッシュを再検証
 */
export const useChangeUserStatus = () =>
  useDomainMutation<User, TriggerArg>(
    "users/change-status",
    async (arg) => {
      try {
        return await userClient.changeStatus(arg.userId, arg.data);
      } catch (error) {
        throw normalizeHttpError(error, "ステータスの変更に失敗しました");
      }
    },
    "users",
  );
