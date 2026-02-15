// src/features/milestone/hooks/useMilestoneList.ts

"use client";

import { useDomainList } from "@/lib/crud/hooks";
import { milestoneClient } from "../services/client/milestoneClient";
import type { Milestone } from "../entities";
import type { SWRConfiguration } from "swr";

export const useMilestoneList = (config?: SWRConfiguration) =>
  useDomainList<Milestone>("milestones", milestoneClient.getAll, config);
