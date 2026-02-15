// src/features/milestone/hooks/useBulkUpsertMilestone.ts

"use client";

import { useBulkUpsertDomain } from "@/lib/crud/hooks";
import { milestoneClient } from "../services/client/milestoneClient";
import type { Milestone } from "../entities";
import type { MilestoneCreateFields } from "../entities/form";

export const useBulkUpsertMilestone = () => {
  const bulkUpsert = milestoneClient.bulkUpsert;

  if (!bulkUpsert) {
    throw new Error("Milestoneの一括アップサート機能が利用できません");
  }

  return useBulkUpsertDomain<Milestone, MilestoneCreateFields>(
    "milestones/bulk-upsert",
    bulkUpsert,
    "milestones",
  );
};
