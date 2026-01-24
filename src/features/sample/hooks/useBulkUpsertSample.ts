// src/features/sample/hooks/useBulkUpsertSample.ts

"use client";

import { useBulkUpsertDomain } from "@/lib/crud/hooks";
import { sampleClient } from "../services/client/sampleClient";
import type { Sample } from "../entities";
import type { SampleCreateFields } from "../entities/form";

export const useBulkUpsertSample = () => {
  const bulkUpsert = sampleClient.bulkUpsert;

  if (!bulkUpsert) {
    throw new Error("Sampleの一括アップサート機能が利用できません");
  }

  return useBulkUpsertDomain<Sample, SampleCreateFields>(
    "samples/bulk-upsert",
    bulkUpsert,
    "samples",
  );
};
