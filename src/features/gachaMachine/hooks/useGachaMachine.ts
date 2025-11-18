// src/features/gachaMachine/hooks/useGachaMachine.ts

"use client";

import { useDomain } from "@/lib/crud/hooks";
import { gachaMachineClient } from "../services/client/gachaMachineClient";
import type { GachaMachine } from "../entities";

export const useGachaMachine = (id?: string | null) =>
  useDomain<GachaMachine | undefined>(
    id ? `gachaMachine:${id}` : null,
    () => gachaMachineClient.getById(id!) as Promise<GachaMachine>,
  );
