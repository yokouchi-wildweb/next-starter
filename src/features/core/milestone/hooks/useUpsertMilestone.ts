// src/features/milestone/hooks/useUpsertMilestone.ts

"use client";

import { useUpsertDomain } from "@/lib/crud/hooks";
import { milestoneClient } from "../services/client/milestoneClient";
import type { Milestone } from "../entities";
import type { MilestoneCreateFields } from "../entities/form";

export const useUpsertMilestone = () => {
  const upsert = milestoneClient.upsert;

  if (!upsert) {
    throw new Error("Milestoneのアップサート機能が利用できません");
  }

  return useUpsertDomain<Milestone, MilestoneCreateFields>(
    "milestones/upsert",
    upsert,
    "milestones",
  );
};
