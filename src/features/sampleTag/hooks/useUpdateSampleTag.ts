// src/features/sampleTag/hooks/useUpdateSampleTag.ts

"use client";

import { useUpdateDomain } from "@/lib/crud/hooks";
import { sampleTagClient } from "../services/client/sampleTagClient";
import type { SampleTag } from "../entities";
import type { SampleTagUpdateFields } from "../entities/form";

export const useUpdateSampleTag = () =>
  useUpdateDomain<SampleTag, SampleTagUpdateFields>(
    "sampleTags/update",
    sampleTagClient.update,
    "sampleTags",
  );
