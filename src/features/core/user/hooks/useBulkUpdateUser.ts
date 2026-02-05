// src/features/core/user/hooks/useBulkUpdateUser.ts

"use client";

import { useBulkUpdateDomain } from "@/lib/crud/hooks";
import { userClient } from "../services/client/userClient";
import type { User } from "../entities";
import type { UpdateUserInput } from "../services/types";

export const useBulkUpdateUser = () => {
  const bulkUpdate = userClient.bulkUpdate;

  if (!bulkUpdate) {
    throw new Error("Userの一括更新機能が利用できません");
  }

  return useBulkUpdateDomain<User, UpdateUserInput>(
    "users/bulk-update",
    bulkUpdate,
    "users",
  );
};
