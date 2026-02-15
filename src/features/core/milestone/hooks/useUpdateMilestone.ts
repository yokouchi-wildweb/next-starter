// src/features/milestone/hooks/useUpdateMilestone.ts

"use client";

import { useUpdateDomain } from "@/lib/crud/hooks";
import { milestoneClient } from "../services/client/milestoneClient";
import type { Milestone } from "../entities";
import type { MilestoneUpdateFields } from "../entities/form";

export const useUpdateMilestone = () =>
  useUpdateDomain<Milestone, MilestoneUpdateFields>(
    "milestones/update",
    milestoneClient.update,
    "milestones",
  );
