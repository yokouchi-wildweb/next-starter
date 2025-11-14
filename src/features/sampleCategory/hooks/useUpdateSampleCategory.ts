// src/features/sampleCategory/hooks/useUpdateSampleCategory.ts

"use client";

import { useUpdateDomain } from "@/lib/crud/hooks";
import { sampleCategoryClient } from "../services/client/sampleCategoryClient";
import type { SampleCategory } from "../entities";
import type { SampleCategoryUpdateFields } from "../entities/form";

export const useUpdateSampleCategory = () =>
  useUpdateDomain<SampleCategory, SampleCategoryUpdateFields>(
    "sampleCategories/update",
    sampleCategoryClient.update,
    "sampleCategories",
  );
