// src/features/sampleTag/hooks/useUpsertSampleTag.ts

"use client";

import { useUpsertDomain } from "@/lib/crud/hooks";
import { sampleTagClient } from "../services/client/sampleTagClient";
import type { SampleTag } from "../entities";
import type { SampleTagCreateFields } from "../entities/form";

export const useUpsertSampleTag = () => {
  const upsert = sampleTagClient.upsert;

  if (!upsert) {
    throw new Error("SampleTagのアップサート機能が利用できません");
  }

  return useUpsertDomain<SampleTag, SampleTagCreateFields>(
    "sampleTags/upsert",
    upsert,
    "sampleTags",
  );
};
