// src/features/rateLimit/hooks/useUpdateRateLimit.ts

"use client";

import { useUpdateDomain } from "@/lib/crud/hooks";
import { rateLimitClient } from "../services/client/rateLimitClient";
import type { RateLimit } from "../entities";
import type { RateLimitUpdateFields } from "../entities/form";

export const useUpdateRateLimit = () =>
  useUpdateDomain<RateLimit, RateLimitUpdateFields>(
    "rateLimits/update",
    rateLimitClient.update,
    "rateLimits",
  );
