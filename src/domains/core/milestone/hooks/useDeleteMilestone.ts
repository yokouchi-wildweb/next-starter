// src/domains/milestone/hooks/useDeleteMilestone.ts

"use client";

import { useDeleteDomain } from "@/lib/crud";
import { milestoneClient } from "../services/client/milestoneClient";

export const useDeleteMilestone = () => useDeleteDomain("milestones/delete", milestoneClient.delete, "milestones");
