// src/features/sample/hooks/useDuplicateSample.ts

"use client";

import { useDuplicateDomain } from "@/lib/crud/hooks";
import { sampleClient } from "../services/client/sampleClient";

export const useDuplicateSample = () =>
  useDuplicateDomain("samples/duplicate", sampleClient.duplicate!, "samples");
