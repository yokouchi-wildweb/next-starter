// src/features/series/services/client/seriesClient.ts

import { createApiClient } from "@/lib/crud/apiClientFactory";
import type { ApiClient } from "@/lib/crud/types";
import type { Series } from "@/features/series/entities";
import type { SeriesCreateFields } from "@/features/series/entities/form";

export const seriesClient: ApiClient<Series, SeriesCreateFields> =
  createApiClient<Series, SeriesCreateFields>("/api/series");
