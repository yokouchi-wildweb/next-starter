// src/features/sampleTag/hooks/useSampleTag.ts

"use client";

import { useDomain } from "@/lib/crud/hooks";
import { sampleTagClient } from "../services/client/sampleTagClient";
import type { SampleTag } from "../entities";

export const useSampleTag = (id?: string | null) =>
  useDomain<SampleTag | undefined>(
    id ? `sampleTag:${id}` : null,
    () => sampleTagClient.getById(id!) as Promise<SampleTag>,
  );
