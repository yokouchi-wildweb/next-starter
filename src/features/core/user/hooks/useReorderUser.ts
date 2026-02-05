// src/features/core/user/hooks/useReorderUser.ts

"use client";

import { useReorderDomain } from "@/lib/crud/hooks";
import { userClient } from "../services/client/userClient";
import type { User } from "../entities";

export const useReorderUser = () => {
  const reorder = userClient.reorder;

  if (!reorder) {
    throw new Error("Userの並び替え機能が利用できません");
  }

  return useReorderDomain<User>("users/reorder", reorder, "users");
};
