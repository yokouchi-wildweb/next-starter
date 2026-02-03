// src/features/rateLimit/hooks/useDeleteRateLimit.ts

"use client";

import { useDeleteDomain } from "@/lib/crud/hooks";
import { rateLimitClient } from "../services/client/rateLimitClient";

export const useDeleteRateLimit = () => useDeleteDomain("rateLimits/delete", rateLimitClient.delete, "rateLimits");
