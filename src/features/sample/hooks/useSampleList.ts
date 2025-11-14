// src/features/sample/hooks/useSampleList.ts

"use client";

import { useDomainList } from "@/lib/crud/hooks";
import { sampleClient } from "../services/client/sampleClient";
import type { Sample } from "../entities";
import type { SWRConfiguration } from "swr";

export const useSampleList = (config?: SWRConfiguration) =>
  useDomainList<Sample>("samples", sampleClient.getAll, config);
