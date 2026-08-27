// src/features/sample/hooks/useReplaceByQuerySample.ts

"use client";

import { useReplaceByQueryDomain } from "@/lib/crud/hooks";
import { sampleClient } from "../services/client/sampleClient";
import type { Sample } from "../entities";
import type { SampleCreateFields } from "../entities/form";

export const useReplaceByQuerySample = () => {
  const replaceByQuery = sampleClient.replaceByQuery;

  if (!replaceByQuery) {
    throw new Error("Sampleの条件指定一括置換機能が利用できません");
  }

  return useReplaceByQueryDomain<Sample, SampleCreateFields>(
    "samples/replace-by-query",
    replaceByQuery,
    "samples",
  );
};
