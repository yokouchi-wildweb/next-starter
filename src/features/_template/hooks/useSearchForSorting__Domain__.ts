// src/features/__domain__/hooks/useSearchForSorting__Domain__.ts

"use client";

import { useSearchForSortingDomain } from "@/lib/crud/hooks";
import { __domain__Client } from "../services/client/__domain__Client";
import type { __Domain__ } from "../entities";
import type { SearchParams } from "@/lib/crud/types";

export const useSearchForSorting__Domain__ = (params: SearchParams = {}) => {
  const searchForSorting = __domain__Client.searchForSorting;

  if (!searchForSorting) {
    throw new Error("__Domain__のソート用検索機能が利用できません");
  }

  return useSearchForSortingDomain<__Domain__>("__domains__/search-for-sorting", searchForSorting, params);
};
