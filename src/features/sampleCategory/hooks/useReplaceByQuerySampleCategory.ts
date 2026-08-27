// src/features/sampleCategory/hooks/useReplaceByQuerySampleCategory.ts

"use client";

import { useReplaceByQueryDomain } from "@/lib/crud/hooks";
import { sampleCategoryClient } from "../services/client/sampleCategoryClient";
import type { SampleCategory } from "../entities";
import type { SampleCategoryCreateFields } from "../entities/form";

export const useReplaceByQuerySampleCategory = () => {
  const replaceByQuery = sampleCategoryClient.replaceByQuery;

  if (!replaceByQuery) {
    throw new Error("SampleCategoryの条件指定一括置換機能が利用できません");
  }

  return useReplaceByQueryDomain<SampleCategory, SampleCategoryCreateFields>(
    "sampleCategories/replace-by-query",
    replaceByQuery,
    "sampleCategories",
  );
};
