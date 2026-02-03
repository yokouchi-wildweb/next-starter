// src/features/rateLimit/hooks/useRateLimit.ts

"use client";

import { useDomain } from "@/lib/crud/hooks";
import { rateLimitClient } from "../services/client/rateLimitClient";
import type { RateLimit } from "../entities";

export const useRateLimit = (id?: string | null) =>
  useDomain<RateLimit | undefined>(
    id ? `rateLimit:${id}` : null,
    () => rateLimitClient.getById(id!) as Promise<RateLimit>,
  );
