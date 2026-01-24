// src/features/sample/hooks/useSearchForSortingSample.ts

"use client";

import { useSearchForSortingDomain } from "@/lib/crud/hooks";
import { sampleClient } from "../services/client/sampleClient";
import type { Sample } from "../entities";
import type { SearchParams } from "@/lib/crud/types";

export const useSearchForSortingSample = (params: SearchParams = {}) => {
  const searchForSorting = sampleClient.searchForSorting;

  if (!searchForSorting) {
    throw new Error("Sampleのソート用検索機能が利用できません");
  }

  return useSearchForSortingDomain<Sample>("samples/search-for-sorting", searchForSorting, params);
};
