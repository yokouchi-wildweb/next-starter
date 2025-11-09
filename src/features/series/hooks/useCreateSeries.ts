// src/features/series/hooks/useCreateSeries.ts

"use client";

import { useCreateDomain } from "@/lib/crud/hooks";
import { seriesClient } from "../services/client/seriesClient";
import type { Series } from "../entities";
import type { SeriesCreateFields } from "../entities/form";

export const useCreateSeries = () =>
  useCreateDomain<Series, SeriesCreateFields>("series/create", seriesClient.create, "series");
