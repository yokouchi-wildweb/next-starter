// src/features/sampleCategory/hooks/useDeleteSampleCategory.ts

"use client";

import { useDeleteDomain } from "@/lib/crud/hooks";
import { sampleCategoryClient } from "../services/client/sampleCategoryClient";

export const useDeleteSampleCategory = () => useDeleteDomain("sampleCategories/delete", sampleCategoryClient.delete, "sampleCategories");
