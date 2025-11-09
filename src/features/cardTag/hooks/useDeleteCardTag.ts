// src/features/cardTag/hooks/useDeleteCardTag.ts

"use client";
import { useDeleteDomain } from "@/lib/crud/hooks";
import { cardTagClient } from "../services/client/cardTagClient";

export const useDeleteCardTag = () =>
  useDeleteDomain("cardTags/delete", cardTagClient.delete, "cardTags");
