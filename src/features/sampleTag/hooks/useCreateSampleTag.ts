// src/features/sampleTag/hooks/useCreateSampleTag.ts

"use client";

import { useCreateDomain } from "@/lib/crud/hooks";
import { sampleTagClient } from "../services/client/sampleTagClient";
import type { SampleTag } from "../entities";
import type { SampleTagCreateFields } from "../entities/form";

export const useCreateSampleTag = () =>
  useCreateDomain<SampleTag, SampleTagCreateFields>("sampleTags/create", sampleTagClient.create, "sampleTags");
