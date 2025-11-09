// src/features/cardTag/hooks/useCreateCardTag.ts

"use client";
import { useCreateDomain } from "@/lib/crud/hooks";
import { cardTagClient } from "../services/client/cardTagClient";
import type { CardTag } from "../entities";
import type { CardTagCreateFields } from "../entities/form";

export const useCreateCardTag = () =>
  useCreateDomain<CardTag, CardTagCreateFields>("cardTags/create", cardTagClient.create, "cardTags");
