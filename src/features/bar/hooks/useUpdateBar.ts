// src/features/bar/hooks/useUpdateBar.ts

"use client";

import { useUpdateDomain } from "@/lib/crud/hooks";
import { barClient } from "../services/client/barClient";
import type { Bar } from "../entities";
import type { BarUpdateFields } from "../entities/form";

export const useUpdateBar = () =>
  useUpdateDomain<Bar, BarUpdateFields>(
    "bars/update",
    barClient.update,
    "bars",
  );
