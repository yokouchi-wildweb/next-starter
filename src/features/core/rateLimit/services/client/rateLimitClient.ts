// src/features/rateLimit/services/client/rateLimitClient.ts

import { createApiClient } from "@/lib/crud";
import type { ApiClient } from "@/lib/crud/types";
import type { RateLimit } from "@/features/core/rateLimit/entities";
import type {
  RateLimitCreateFields,
  RateLimitUpdateFields,
} from "@/features/core/rateLimit/entities/form";

export const rateLimitClient: ApiClient<
  RateLimit,
  RateLimitCreateFields,
  RateLimitUpdateFields
> = createApiClient<
  RateLimit,
  RateLimitCreateFields,
  RateLimitUpdateFields
>("/api/rateLimit");
