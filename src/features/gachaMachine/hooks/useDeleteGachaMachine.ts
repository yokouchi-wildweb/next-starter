// src/features/gachaMachine/hooks/useDeleteGachaMachine.ts

"use client";

import { useDeleteDomain } from "@/lib/crud/hooks";
import { gachaMachineClient } from "../services/client/gachaMachineClient";

export const useDeleteGachaMachine = () => useDeleteDomain("gachaMachines/delete", gachaMachineClient.delete, "gachaMachines");
