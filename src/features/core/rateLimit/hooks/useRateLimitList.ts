// src/features/rateLimit/hooks/useRateLimitList.ts

"use client";

import { useDomainList } from "@/lib/crud/hooks";
import { rateLimitClient } from "../services/client/rateLimitClient";
import type { RateLimit } from "../entities";
import type { SWRConfiguration } from "swr";

export const useRateLimitList = (config?: SWRConfiguration) =>
  useDomainList<RateLimit>("rateLimits", rateLimitClient.getAll, config);
