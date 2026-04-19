// src/features/sampleCategory/hooks/useCountSampleCategory.ts

"use client";

import { useCountDomain } from "@/lib/crud/hooks";
import { sampleCategoryClient } from "../services/client/sampleCategoryClient";
import type { CountParams } from "@/lib/crud/types";

export const useCountSampleCategory = (params: CountParams) => {
  const count = sampleCategoryClient.count;

  if (!count) {
    throw new Error("SampleCategoryのカウント機能が利用できません");
  }

  return useCountDomain<CountParams>(
    "sampleCategories/count",
    count,
    params,
  );
};
