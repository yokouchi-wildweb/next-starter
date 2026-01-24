// src/features/sample/hooks/useReorderSample.ts

"use client";

import { useReorderDomain } from "@/lib/crud/hooks";
import { sampleClient } from "../services/client/sampleClient";
import type { Sample } from "../entities";

export const useReorderSample = () => {
  const reorder = sampleClient.reorder;

  if (!reorder) {
    throw new Error("Sampleの並び替え機能が利用できません");
  }

  return useReorderDomain<Sample>("samples/reorder", reorder, "samples");
};
