// src/features/sample/services/client/sampleClient.ts

import { createApiClient } from "@/lib/crud/apiClientFactory";
import type { ApiClient } from "@/lib/crud/types";
import type { Sample } from "@/features/sample/entities";
import type {
  SampleCreateFields,
  SampleUpdateFields,
} from "@/features/sample/entities/form";

export const sampleClient: ApiClient<
  Sample,
  SampleCreateFields,
  SampleUpdateFields
> = createApiClient<
  Sample,
  SampleCreateFields,
  SampleUpdateFields
>("/api/sample");
