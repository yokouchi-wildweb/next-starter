// src/features/setting/hooks/useAdminSetup.ts

"use client";

import type { User } from "@/features/core/user/entities";
import { useDomainMutation } from "@/lib/crud/hooks";

import { adminSetupClient } from "../services/client/adminSetupClient";
import type { AdminSetupInput } from "../services/types";

/**
 * 管理者初期セットアップを実行するフック
 * 並列 trigger 安全（lib/crud/hooks/internal/useDomainMutation に準拠）
 */
export const useAdminSetup = () => {
  const mutation = useDomainMutation<User, AdminSetupInput>(
    "setting/setup",
    (input) => adminSetupClient.initialize(input),
  );

  return {
    trigger: mutation.trigger,
    isMutating: mutation.isMutating,
    error: mutation.error,
  };
};
