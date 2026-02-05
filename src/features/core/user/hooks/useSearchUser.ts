// src/features/core/user/hooks/useSearchUser.ts

"use client";

import { useSearchDomain } from "@/lib/crud/hooks";
import { userClient } from "../services/client/userClient";
import type { User } from "../entities";
import type { SearchParams } from "@/lib/crud/types";

export type UserSearchParams = typeof userClient.search extends (
  params: infer P,
) => Promise<unknown>
  ? P
  : SearchParams;

export const useSearchUser = (params: UserSearchParams) => {
  const search = userClient.search;

  if (!search) {
    throw new Error("Userの検索機能が利用できません");
  }

  return useSearchDomain<User, UserSearchParams>(
    "users/search",
    search,
    params,
  );
};
