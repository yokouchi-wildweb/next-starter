// src/features/sample/hooks/useUpdateSample.ts

"use client";

import { useUpdateDomain } from "@/lib/crud/hooks";
import { sampleClient } from "../services/client/sampleClient";
import type { Sample } from "../entities";
import type { SampleUpdateFields } from "../entities/form";

export const useUpdateSample = () =>
  useUpdateDomain<Sample, SampleUpdateFields>(
    "samples/update",
    sampleClient.update,
    "samples",
  );
