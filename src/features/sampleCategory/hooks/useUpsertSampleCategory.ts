// src/features/sampleCategory/hooks/useUpsertSampleCategory.ts

"use client";

import { useUpsertDomain } from "@/lib/crud/hooks";
import { sampleCategoryClient } from "../services/client/sampleCategoryClient";
import type { SampleCategory } from "../entities";
import type { SampleCategoryCreateFields } from "../entities/form";

export const useUpsertSampleCategory = () => {
  const upsert = sampleCategoryClient.upsert;

  if (!upsert) {
    throw new Error("SampleCategoryのアップサート機能が利用できません");
  }

  return useUpsertDomain<SampleCategory, SampleCategoryCreateFields>(
    "sampleCategories/upsert",
    upsert,
    "sampleCategories",
  );
};
