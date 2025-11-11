// src/features/sample/hooks/useCreateSample.ts

"use client";

import { useCreateDomain } from "@/lib/crud/hooks";
import { sampleClient } from "../services/client/sampleClient";
import type { Sample } from "../entities";
import type { SampleCreateFields } from "../entities/form";

export const useCreateSample = () =>
  useCreateDomain<Sample, SampleCreateFields>("samples/create", sampleClient.create, "samples");
