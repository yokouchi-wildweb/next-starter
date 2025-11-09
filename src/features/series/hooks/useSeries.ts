// src/features/series/hooks/useSeries.ts

"use client";

import { useDomainList } from "@/lib/crud/hooks";
import { seriesClient } from "../services/client/seriesClient";
import type { Series } from "../entities";
import type { SWRConfiguration } from "swr";

export const useSeries = (config?: SWRConfiguration) =>
  useDomainList<Series>("series", seriesClient.getAll, config);
