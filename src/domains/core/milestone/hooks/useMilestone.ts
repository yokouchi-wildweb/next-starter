// src/domains/milestone/hooks/useMilestone.ts

"use client";

import { useDomain } from "@/lib/crud";
import { milestoneClient } from "../services/client/milestoneClient";
import type { Milestone } from "../entities";

export const useMilestone = (id?: string | null) =>
  useDomain<Milestone | undefined>(
    id ? `milestone:${id}` : null,
    () => milestoneClient.get(id!) as Promise<Milestone>,
  );
