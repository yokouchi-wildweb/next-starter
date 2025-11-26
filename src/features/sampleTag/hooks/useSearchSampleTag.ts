// src/features/sampleTag/hooks/useSearchSampleTag.ts

"use client";

import { useSearchDomain } from "@/lib/crud/hooks";
import { sampleTagClient } from "../services/client/sampleTagClient";
import type { SampleTag } from "../entities";
import type { SearchParams } from "@/lib/crud/types";

export type SampleTagSearchParams = typeof sampleTagClient.search extends (
  params: infer P,
) => Promise<unknown>
  ? P
  : SearchParams;

export const useSearchSampleTag = (params: SampleTagSearchParams) => {
  const search = sampleTagClient.search;

  if (!search) {
    throw new Error("SampleTagの検索機能が利用できません");
  }

  return useSearchDomain<SampleTag, SampleTagSearchParams>(
    "sampleTags/search",
    search,
    params,
  );
};
