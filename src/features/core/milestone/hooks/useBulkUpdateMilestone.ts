// src/features/milestone/hooks/useBulkUpdateMilestone.ts

"use client";

import { useBulkUpdateDomain } from "@/lib/crud/hooks";
import { milestoneClient } from "../services/client/milestoneClient";
import type { Milestone } from "../entities";
import type { MilestoneUpdateFields } from "../entities/form";

export const useBulkUpdateMilestone = () => {
  const bulkUpdate = milestoneClient.bulkUpdate;

  if (!bulkUpdate) {
    throw new Error("Milestoneの一括更新機能が利用できません");
  }

  return useBulkUpdateDomain<Milestone, MilestoneUpdateFields>(
    "milestones/bulk-update",
    bulkUpdate,
    "milestones",
  );
};
