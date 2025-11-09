// src/features/series/hooks/useDeleteSeries.ts

"use client";

import { useDeleteDomain } from "@/lib/crud/hooks";
import { seriesClient } from "../services/client/seriesClient";

export const useDeleteSeries = () =>
  useDeleteDomain("series/delete", seriesClient.delete, "series");
