// src/features/sample/hooks/useSample.ts

"use client";

import { useDomain } from "@/lib/crud/hooks";
import { sampleClient } from "../services/client/sampleClient";
import type { Sample } from "../entities";

export const useSample = (id?: string | null) =>
  useDomain<Sample | undefined>(
    id ? `sample:${id}` : null,
    () => sampleClient.getById(id!) as Promise<Sample>,
  );
