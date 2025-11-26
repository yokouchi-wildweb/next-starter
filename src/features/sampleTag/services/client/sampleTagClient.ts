// src/features/sampleTag/services/client/sampleTagClient.ts

import { createApiClient } from "@/lib/crud/apiClientFactory";
import type { ApiClient } from "@/lib/crud/types";
import type { SampleTag } from "@/features/sampleTag/entities";
import type {
  SampleTagCreateFields,
  SampleTagUpdateFields,
} from "@/features/sampleTag/entities/form";

export const sampleTagClient: ApiClient<
  SampleTag,
  SampleTagCreateFields,
  SampleTagUpdateFields
> = createApiClient<
  SampleTag,
  SampleTagCreateFields,
  SampleTagUpdateFields
>("/api/sampleTag");
