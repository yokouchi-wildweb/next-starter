// src/features/sampleCategory/services/client/sampleCategoryClient.ts

import { createApiClient } from "@/lib/crud/apiClientFactory";
import type { ApiClient } from "@/lib/crud/types";
import type { SampleCategory } from "@/features/sampleCategory/entities";
import type {
  SampleCategoryCreateFields,
  SampleCategoryUpdateFields,
} from "@/features/sampleCategory/entities/form";

export const sampleCategoryClient: ApiClient<
  SampleCategory,
  SampleCategoryCreateFields,
  SampleCategoryUpdateFields
> = createApiClient<
  SampleCategory,
  SampleCategoryCreateFields,
  SampleCategoryUpdateFields
>("/api/sampleCategory");
