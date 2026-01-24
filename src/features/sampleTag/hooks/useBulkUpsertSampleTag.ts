// src/features/sampleTag/hooks/useBulkUpsertSampleTag.ts

"use client";

import { useBulkUpsertDomain } from "@/lib/crud/hooks";
import { sampleTagClient } from "../services/client/sampleTagClient";
import type { SampleTag } from "../entities";
import type { SampleTagCreateFields } from "../entities/form";

export const useBulkUpsertSampleTag = () => {
  const bulkUpsert = sampleTagClient.bulkUpsert;

  if (!bulkUpsert) {
    throw new Error("SampleTagの一括アップサート機能が利用できません");
  }

  return useBulkUpsertDomain<SampleTag, SampleTagCreateFields>(
    "sampleTags/bulk-upsert",
    bulkUpsert,
    "sampleTags",
  );
};
