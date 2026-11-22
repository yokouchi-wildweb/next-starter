// src/domains/milestone/services/client/milestoneClient.ts

import { createApiClient } from "@/lib/crud";
import type { ApiClient } from "@/lib/crud";
import type { Milestone } from "@/domains/core/milestone/entities";
import type {
  MilestoneCreateFields,
  MilestoneUpdateFields,
} from "@/domains/core/milestone/entities/form";

export const milestoneClient: ApiClient<
  Milestone,
  MilestoneCreateFields,
  MilestoneUpdateFields
> = createApiClient<
  Milestone,
  MilestoneCreateFields,
  MilestoneUpdateFields
>("/api/milestone");
