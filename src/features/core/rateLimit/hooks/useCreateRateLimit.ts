// src/features/rateLimit/hooks/useCreateRateLimit.ts

"use client";

import { useCreateDomain } from "@/lib/crud/hooks";
import { rateLimitClient } from "../services/client/rateLimitClient";
import type { RateLimit } from "../entities";
import type { RateLimitCreateFields } from "../entities/form";

export const useCreateRateLimit = () =>
  useCreateDomain<RateLimit, RateLimitCreateFields>("rateLimits/create", rateLimitClient.create, "rateLimits");
