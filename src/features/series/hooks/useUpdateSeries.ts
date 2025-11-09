// src/features/series/hooks/useUpdateSeries.ts

"use client";

import { useUpdateDomain } from "@/lib/crud/hooks";
import { seriesClient } from "../services/client/seriesClient";
import type { Series } from "../entities";

export const useUpdateSeries = () =>
  useUpdateDomain<Series>("series/update", seriesClient.update, "series");
