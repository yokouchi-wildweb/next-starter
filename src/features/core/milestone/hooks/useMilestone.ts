// src/features/milestone/hooks/useMilestone.ts

"use client";

import { useDomain } from "@/lib/crud/hooks";
import { milestoneClient } from "../services/client/milestoneClient";
import type { Milestone } from "../entities";

export const useMilestone = (id?: string | null) =>
  useDomain<Milestone | undefined>(
    id ? `milestone:${id}` : null,
    () => milestoneClient.getById(id!) as Promise<Milestone>,
  );
