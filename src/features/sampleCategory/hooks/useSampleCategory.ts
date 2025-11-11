// src/features/sampleCategory/hooks/useSampleCategory.ts

"use client";

import { useDomain } from "@/lib/crud/hooks";
import { sampleCategoryClient } from "../services/client/sampleCategoryClient";
import type { SampleCategory } from "../entities";

export const useSampleCategory = (id?: string | null) =>
  useDomain<SampleCategory | undefined>(
    id ? `sampleCategory:${id}` : null,
    () => sampleCategoryClient.getById(id!) as Promise<SampleCategory>,
  );
