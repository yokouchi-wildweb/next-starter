// src/features/sample/hooks/useBulkUpdateSample.ts

"use client";

import { useBulkUpdateDomain } from "@/lib/crud/hooks";
import { sampleClient } from "../services/client/sampleClient";
import type { Sample } from "../entities";
import type { SampleUpdateFields } from "../entities/form";

export const useBulkUpdateSample = () => {
  const bulkUpdate = sampleClient.bulkUpdate;

  if (!bulkUpdate) {
    throw new Error("Sampleの一括更新機能が利用できません");
  }

  return useBulkUpdateDomain<Sample, SampleUpdateFields>(
    "samples/bulk-update",
    bulkUpdate,
    "samples",
  );
};
