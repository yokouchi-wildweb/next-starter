// src/features/bar/services/client/barClient.ts

import { createApiClient } from "@/lib/crud/apiClientFactory";
import type { ApiClient } from "@/lib/crud/types";
import type { Bar } from "@/features/bar/entities";
import type {
  BarCreateFields,
  BarUpdateFields,
} from "@/features/bar/entities/form";

export const barClient: ApiClient<
  Bar,
  BarCreateFields,
  BarUpdateFields
> = createApiClient<
  Bar,
  BarCreateFields,
  BarUpdateFields
>("/api/bar");
