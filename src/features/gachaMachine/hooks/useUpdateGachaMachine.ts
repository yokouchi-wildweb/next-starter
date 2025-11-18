// src/features/gachaMachine/hooks/useUpdateGachaMachine.ts

"use client";

import { useUpdateDomain } from "@/lib/crud/hooks";
import { gachaMachineClient } from "../services/client/gachaMachineClient";
import type { GachaMachine } from "../entities";
import type { GachaMachineUpdateFields } from "../entities/form";

export const useUpdateGachaMachine = () =>
  useUpdateDomain<GachaMachine, GachaMachineUpdateFields>(
    "gachaMachines/update",
    gachaMachineClient.update,
    "gachaMachines",
  );
