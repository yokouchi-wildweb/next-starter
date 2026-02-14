// src/features/referral/services/client/referralClient.ts

import { createApiClient } from "@/lib/crud";
import type { ApiClient } from "@/lib/crud/types";
import type { Referral } from "@/features/core/referral/entities";
import type {
  ReferralCreateFields,
  ReferralUpdateFields,
} from "@/features/core/referral/entities/form";

export const referralClient: ApiClient<
  Referral,
  ReferralCreateFields,
  ReferralUpdateFields
> = createApiClient<
  Referral,
  ReferralCreateFields,
  ReferralUpdateFields
>("/api/referral");
