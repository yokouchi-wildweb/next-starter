// src/features/sample/hooks/useCountSample.ts

"use client";

import { useCountDomain } from "@/lib/crud/hooks";
import { sampleClient } from "../services/client/sampleClient";
import type { CountParams } from "@/lib/crud/types";

export const useCountSample = (params: CountParams) => {
  const count = sampleClient.count;

  if (!count) {
    throw new Error("Sampleのカウント機能が利用できません");
  }

  return useCountDomain<CountParams>(
    "samples/count",
    count,
    params,
  );
};
