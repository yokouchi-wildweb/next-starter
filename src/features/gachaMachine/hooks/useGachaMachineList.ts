// src/features/gachaMachine/hooks/useGachaMachineList.ts

"use client";

import { useDomainList } from "@/lib/crud/hooks";
import { gachaMachineClient } from "../services/client/gachaMachineClient";
import type { GachaMachine } from "../entities";
import type { SWRConfiguration } from "swr";

export const useGachaMachineList = (config?: SWRConfiguration) =>
  useDomainList<GachaMachine>("gachaMachines", gachaMachineClient.getAll, config);
