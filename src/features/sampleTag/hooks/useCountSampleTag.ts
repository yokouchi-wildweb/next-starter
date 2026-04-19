// src/features/sampleTag/hooks/useCountSampleTag.ts

"use client";

import { useCountDomain } from "@/lib/crud/hooks";
import { sampleTagClient } from "../services/client/sampleTagClient";
import type { CountParams } from "@/lib/crud/types";

export const useCountSampleTag = (params: CountParams) => {
  const count = sampleTagClient.count;

  if (!count) {
    throw new Error("SampleTagのカウント機能が利用できません");
  }

  return useCountDomain<CountParams>(
    "sampleTags/count",
    count,
    params,
  );
};
