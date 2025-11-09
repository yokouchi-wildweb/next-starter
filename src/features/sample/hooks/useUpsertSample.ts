// src/features/sample/hooks/useUpsertSample.ts

"use client";

import { useUpsertDomain } from "@/lib/crud/hooks";
import { sampleClient } from "../services/client/sampleClient";
import type { Sample } from "../entities";
import type { SampleCreateFields } from "../entities/form";

export const useUpsertSample = () => {
  const upsert = sampleClient.upsert;

  if (!upsert) {
    throw new Error("Sampleのアップサート機能が利用できません");
  }

  return useUpsertDomain<Sample, SampleCreateFields>("samples/upsert", upsert, "samples");
};
