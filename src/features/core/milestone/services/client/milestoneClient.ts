// src/features/milestone/services/client/milestoneClient.ts

import { createApiClient } from "@/lib/crud";
import type { ApiClient } from "@/lib/crud/types";
import type { Milestone } from "@/features/core/milestone/entities";
import type {
  MilestoneCreateFields,
  MilestoneUpdateFields,
} from "@/features/core/milestone/entities/form";

export const milestoneClient: ApiClient<
  Milestone,
  MilestoneCreateFields,
  MilestoneUpdateFields
> = createApiClient<
  Milestone,
  MilestoneCreateFields,
  MilestoneUpdateFields
>("/api/milestone");
