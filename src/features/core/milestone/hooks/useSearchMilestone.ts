// src/features/milestone/hooks/useSearchMilestone.ts

"use client";

import { useSearchDomain } from "@/lib/crud/hooks";
import { milestoneClient } from "../services/client/milestoneClient";
import type { Milestone } from "../entities";
import type { SearchParams } from "@/lib/crud/types";

export type MilestoneSearchParams = NonNullable<typeof milestoneClient.search> extends (
  params: infer P,
) => Promise<unknown>
  ? P
  : SearchParams;

export const useSearchMilestone = (params: MilestoneSearchParams) => {
  const search = milestoneClient.search;

  if (!search) {
    throw new Error("Milestoneの検索機能が利用できません");
  }

  return useSearchDomain<Milestone, MilestoneSearchParams>(
    "milestones/search",
    search,
    params,
  );
};
