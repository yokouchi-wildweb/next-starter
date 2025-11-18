// src/features/gachaMachine/hooks/useSearchGachaMachine.ts

"use client";

import { useSearchDomain } from "@/lib/crud/hooks";
import { gachaMachineClient } from "../services/client/gachaMachineClient";
import type { GachaMachine } from "../entities";
import type { SearchParams } from "@/lib/crud/types";

export type GachaMachineSearchParams = typeof gachaMachineClient.search extends (
  params: infer P,
) => Promise<unknown>
  ? P
  : SearchParams;

export const useSearchGachaMachine = (params: GachaMachineSearchParams) => {
  const search = gachaMachineClient.search;

  if (!search) {
    throw new Error("GachaMachineの検索機能が利用できません");
  }

  return useSearchDomain<GachaMachine, GachaMachineSearchParams>(
    "gachaMachines/search",
    search,
    params,
  );
};
