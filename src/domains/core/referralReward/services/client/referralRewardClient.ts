// src/domains/referralReward/services/client/referralRewardClient.ts

import { createApiClient } from "@/lib/crud";
import type { ApiClient } from "@/lib/crud";
import type { ReferralReward } from "@/domains/core/referralReward/entities";
import type {
  ReferralRewardCreateFields,
  ReferralRewardUpdateFields,
} from "@/domains/core/referralReward/entities/form";

export const referralRewardClient: ApiClient<
  ReferralReward,
  ReferralRewardCreateFields,
  ReferralRewardUpdateFields
> = createApiClient<
  ReferralReward,
  ReferralRewardCreateFields,
  ReferralRewardUpdateFields
>("/api/referralReward");
