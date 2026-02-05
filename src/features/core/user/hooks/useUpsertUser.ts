// src/features/core/user/hooks/useUpsertUser.ts

"use client";

import { useUpsertDomain } from "@/lib/crud/hooks";
import { userClient } from "../services/client/userClient";
import type { User } from "../entities";
import type { CreateUserInput } from "../services/types";

export const useUpsertUser = () => {
  const upsert = userClient.upsert;

  if (!upsert) {
    throw new Error("Userのアップサート機能が利用できません");
  }

  return useUpsertDomain<User, CreateUserInput>(
    "users/upsert",
    upsert,
    "users",
  );
};
