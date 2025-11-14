// src/features/sampleCategory/hooks/useSampleCategoryList.ts

"use client";

import { useDomainList } from "@/lib/crud/hooks";
import { sampleCategoryClient } from "../services/client/sampleCategoryClient";
import type { SampleCategory } from "../entities";
import type { SWRConfiguration } from "swr";

export const useSampleCategoryList = (config?: SWRConfiguration) =>
  useDomainList<SampleCategory>("sampleCategories", sampleCategoryClient.getAll, config);
