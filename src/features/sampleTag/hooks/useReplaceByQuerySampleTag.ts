// src/features/sampleTag/hooks/useReplaceByQuerySampleTag.ts

"use client";

import { useReplaceByQueryDomain } from "@/lib/crud/hooks";
import { sampleTagClient } from "../services/client/sampleTagClient";
import type { SampleTag } from "../entities";
import type { SampleTagCreateFields } from "../entities/form";

export const useReplaceByQuerySampleTag = () => {
  const replaceByQuery = sampleTagClient.replaceByQuery;

  if (!replaceByQuery) {
    throw new Error("SampleTagの条件指定一括置換機能が利用できません");
  }

  return useReplaceByQueryDomain<SampleTag, SampleTagCreateFields>(
    "sampleTags/replace-by-query",
    replaceByQuery,
    "sampleTags",
  );
};
