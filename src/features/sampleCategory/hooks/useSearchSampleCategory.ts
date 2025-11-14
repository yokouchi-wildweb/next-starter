// src/features/sampleCategory/hooks/useSearchSampleCategory.ts

"use client";

import { useSearchDomain } from "@/lib/crud/hooks";
import { sampleCategoryClient } from "../services/client/sampleCategoryClient";
import type { SampleCategory } from "../entities";
import type { SearchParams } from "@/lib/crud/types";

export type SampleCategorySearchParams = typeof sampleCategoryClient.search extends (
  params: infer P,
) => Promise<unknown>
  ? P
  : SearchParams;

export const useSearchSampleCategory = (params: SampleCategorySearchParams) => {
  const search = sampleCategoryClient.search;

  if (!search) {
    throw new Error("SampleCategoryの検索機能が利用できません");
  }

  return useSearchDomain<SampleCategory, SampleCategorySearchParams>(
    "sampleCategories/search",
    search,
    params,
  );
};
