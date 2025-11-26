// src/features/sampleTag/hooks/useDeleteSampleTag.ts

"use client";

import { useDeleteDomain } from "@/lib/crud/hooks";
import { sampleTagClient } from "../services/client/sampleTagClient";

export const useDeleteSampleTag = () => useDeleteDomain("sampleTags/delete", sampleTagClient.delete, "sampleTags");
