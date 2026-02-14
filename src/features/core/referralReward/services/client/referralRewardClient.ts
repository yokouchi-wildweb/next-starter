// src/features/referralReward/services/client/referralRewardClient.ts

import { createApiClient } from "@/lib/crud";
import type { ApiClient } from "@/lib/crud/types";
import type { ReferralReward } from "@/features/core/referralReward/entities";
import type {
  ReferralRewardCreateFields,
  ReferralRewardUpdateFields,
} from "@/features/core/referralReward/entities/form";

export const referralRewardClient: ApiClient<
  ReferralReward,
  ReferralRewardCreateFields,
  ReferralRewardUpdateFields
> = createApiClient<
  ReferralReward,
  ReferralRewardCreateFields,
  ReferralRewardUpdateFields
>("/api/referralReward");
