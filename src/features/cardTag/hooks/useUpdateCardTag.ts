// src/features/cardTag/hooks/useUpdateCardTag.ts

"use client";
import { useUpdateDomain } from "@/lib/crud/hooks";
import { cardTagClient } from "../services/client/cardTagClient";
import type { CardTag } from "../entities";

export const useUpdateCardTag = () =>
  useUpdateDomain<CardTag>("cardTags/update", cardTagClient.update, "cardTags");
