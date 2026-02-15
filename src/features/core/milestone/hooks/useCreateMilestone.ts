// src/features/milestone/hooks/useCreateMilestone.ts

"use client";

import { useCreateDomain } from "@/lib/crud/hooks";
import { milestoneClient } from "../services/client/milestoneClient";
import type { Milestone } from "../entities";
import type { MilestoneCreateFields } from "../entities/form";

export const useCreateMilestone = () =>
  useCreateDomain<Milestone, MilestoneCreateFields>("milestones/create", milestoneClient.create, "milestones");
