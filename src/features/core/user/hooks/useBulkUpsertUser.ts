// src/features/core/user/hooks/useBulkUpsertUser.ts

"use client";

import { useBulkUpsertDomain } from "@/lib/crud/hooks";
import { userClient } from "../services/client/userClient";
import type { User } from "../entities";
import type { CreateUserInput } from "../services/types";

export const useBulkUpsertUser = () => {
  const bulkUpsert = userClient.bulkUpsert;

  if (!bulkUpsert) {
    throw new Error("Userの一括アップサート機能が利用できません");
  }

  return useBulkUpsertDomain<User, CreateUserInput>(
    "users/bulk-upsert",
    bulkUpsert,
    "users",
  );
};
