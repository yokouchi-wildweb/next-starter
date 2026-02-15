// src/features/sample/hooks/useSearchSample.ts

"use client";

import { useSearchDomain } from "@/lib/crud/hooks";
import { sampleClient } from "../services/client/sampleClient";
import type { Sample } from "../entities";
import type { SearchParams } from "@/lib/crud/types";

export type SampleSearchParams = NonNullable<typeof sampleClient.search> extends (
  params: infer P,
) => Promise<unknown>
  ? P
  : SearchParams;

export const useSearchSample = (params: SampleSearchParams) => {
  const search = sampleClient.search;

  if (!search) {
    throw new Error("Sampleの検索機能が利用できません");
  }

  return useSearchDomain<Sample, SampleSearchParams>(
    "samples/search",
    search,
    params,
  );
};
