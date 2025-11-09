// src/features/cardTag/hooks/useCardTags.ts

"use client";
import { useDomainList } from "@/lib/crud/hooks";
import type { SWRConfiguration } from "swr";
import { cardTagClient } from "../services/client/cardTagClient";
import type { CardTag } from "../entities";

export const useCardTags = (config?: SWRConfiguration) =>
  useDomainList<CardTag>("cardTags", cardTagClient.getAll, config);
