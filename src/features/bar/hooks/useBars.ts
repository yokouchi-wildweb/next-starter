// src/features/bar/hooks/useBars.ts

"use client";

import { useDomainList } from "@/lib/crud/hooks";
import { barClient } from "../services/client/barClient";
import type { Bar } from "../entities";
import type { SWRConfiguration } from "swr";

export const useBars = (config?: SWRConfiguration) =>
  useDomainList<Bar>("bars", barClient.getAll, config);
