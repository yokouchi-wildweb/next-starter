// src/features/core/user/hooks/useSearchForSortingUser.ts

"use client";

import { useSearchForSortingDomain } from "@/lib/crud/hooks";
import { userClient } from "../services/client/userClient";
import type { User } from "../entities";
import type { SearchParams } from "@/lib/crud/types";

export const useSearchForSortingUser = (params: SearchParams = {}) => {
  const searchForSorting = userClient.searchForSorting;

  if (!searchForSorting) {
    throw new Error("Userのソート用検索機能が利用できません");
  }

  return useSearchForSortingDomain<User>("users/search-for-sorting", searchForSorting, params);
};
