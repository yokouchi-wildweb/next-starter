// src/features/sampleCategory/hooks/useCreateSampleCategory.ts

"use client";

import { useCreateDomain } from "@/lib/crud/hooks";
import { sampleCategoryClient } from "../services/client/sampleCategoryClient";
import type { SampleCategory } from "../entities";
import type { SampleCategoryCreateFields } from "../entities/form";

export const useCreateSampleCategory = () =>
  useCreateDomain<SampleCategory, SampleCategoryCreateFields>("sampleCategories/create", sampleCategoryClient.create, "sampleCategories");
