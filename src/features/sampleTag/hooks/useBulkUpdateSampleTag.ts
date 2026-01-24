// src/features/sampleTag/hooks/useBulkUpdateSampleTag.ts

"use client";

import { useBulkUpdateDomain } from "@/lib/crud/hooks";
import { sampleTagClient } from "../services/client/sampleTagClient";
import type { SampleTag } from "../entities";
import type { SampleTagUpdateFields } from "../entities/form";

export const useBulkUpdateSampleTag = () => {
  const bulkUpdate = sampleTagClient.bulkUpdate;

  if (!bulkUpdate) {
    throw new Error("SampleTagの一括更新機能が利用できません");
  }

  return useBulkUpdateDomain<SampleTag, SampleTagUpdateFields>(
    "sampleTags/bulk-update",
    bulkUpdate,
    "sampleTags",
  );
};
