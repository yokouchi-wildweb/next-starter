// src/features/sampleCategory/hooks/useBulkUpsertSampleCategory.ts

"use client";

import { useBulkUpsertDomain } from "@/lib/crud/hooks";
import { sampleCategoryClient } from "../services/client/sampleCategoryClient";
import type { SampleCategory } from "../entities";
import type { SampleCategoryCreateFields } from "../entities/form";

export const useBulkUpsertSampleCategory = () => {
  const bulkUpsert = sampleCategoryClient.bulkUpsert;

  if (!bulkUpsert) {
    throw new Error("SampleCategoryの一括アップサート機能が利用できません");
  }

  return useBulkUpsertDomain<SampleCategory, SampleCategoryCreateFields>(
    "sampleCategories/bulk-upsert",
    bulkUpsert,
    "sampleCategories",
  );
};
