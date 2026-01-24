// src/features/sampleCategory/hooks/useBulkUpdateSampleCategory.ts

"use client";

import { useBulkUpdateDomain } from "@/lib/crud/hooks";
import { sampleCategoryClient } from "../services/client/sampleCategoryClient";
import type { SampleCategory } from "../entities";
import type { SampleCategoryUpdateFields } from "../entities/form";

export const useBulkUpdateSampleCategory = () => {
  const bulkUpdate = sampleCategoryClient.bulkUpdate;

  if (!bulkUpdate) {
    throw new Error("SampleCategoryの一括更新機能が利用できません");
  }

  return useBulkUpdateDomain<SampleCategory, SampleCategoryUpdateFields>(
    "sampleCategories/bulk-update",
    bulkUpdate,
    "sampleCategories",
  );
};
