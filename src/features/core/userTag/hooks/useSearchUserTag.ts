// src/features/userTag/hooks/useSearchUserTag.ts

"use client";

import { useSearchDomain } from "@/lib/crud/hooks";
import { userTagClient } from "../services/client/userTagClient";
import type { UserTag } from "../entities";
import type { SearchParams } from "@/lib/crud/types";

export type UserTagSearchParams = typeof userTagClient.search extends (
  params: infer P,
) => Promise<unknown>
  ? P
  : SearchParams;

export const useSearchUserTag = (params: UserTagSearchParams) => {
  const search = userTagClient.search;

  if (!search) {
    throw new Error("UserTagの検索機能が利用できません");
  }

  return useSearchDomain<UserTag, UserTagSearchParams>(
    "userTags/search",
    search,
    params,
  );
};
