// src/features/gachaMachine/hooks/useCreateGachaMachine.ts

"use client";

import { useCreateDomain } from "@/lib/crud/hooks";
import { gachaMachineClient } from "../services/client/gachaMachineClient";
import type { GachaMachine } from "../entities";
import type { GachaMachineCreateFields } from "../entities/form";

export const useCreateGachaMachine = () =>
  useCreateDomain<GachaMachine, GachaMachineCreateFields>("gachaMachines/create", gachaMachineClient.create, "gachaMachines");
