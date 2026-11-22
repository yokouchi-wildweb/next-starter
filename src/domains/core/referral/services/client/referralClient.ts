// src/domains/referral/services/client/referralClient.ts

import { createApiClient } from "@/lib/crud";
import type { ApiClient } from "@/lib/crud";
import type { Referral } from "@/domains/core/referral/entities";
import type {
  ReferralCreateFields,
  ReferralUpdateFields,
} from "@/domains/core/referral/entities/form";

export const referralClient: ApiClient<
  Referral,
  ReferralCreateFields,
  ReferralUpdateFields
> = createApiClient<
  Referral,
  ReferralCreateFields,
  ReferralUpdateFields
>("/api/referral");
