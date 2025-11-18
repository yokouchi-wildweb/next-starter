// src/features/gachaMachine/hooks/useUpsertGachaMachine.ts

"use client";

import { useUpsertDomain } from "@/lib/crud/hooks";
import { gachaMachineClient } from "../services/client/gachaMachineClient";
import type { GachaMachine } from "../entities";
import type { GachaMachineCreateFields } from "../entities/form";

export const useUpsertGachaMachine = () => {
  const upsert = gachaMachineClient.upsert;

  if (!upsert) {
    throw new Error("GachaMachineのアップサート機能が利用できません");
  }

  return useUpsertDomain<GachaMachine, GachaMachineCreateFields>(
    "gachaMachines/upsert",
    upsert,
    "gachaMachines",
  );
};
