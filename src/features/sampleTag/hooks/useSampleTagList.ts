// src/features/sampleTag/hooks/useSampleTagList.ts

"use client";

import { useDomainList } from "@/lib/crud/hooks";
import { sampleTagClient } from "../services/client/sampleTagClient";
import type { SampleTag } from "../entities";
import type { SWRConfiguration } from "swr";

export const useSampleTagList = (config?: SWRConfiguration) =>
  useDomainList<SampleTag>("sampleTags", sampleTagClient.getAll, config);
