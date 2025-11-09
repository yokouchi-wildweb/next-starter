// src/features/bar/hooks/useBar.ts

"use client";

import { useDomain } from "@/lib/crud/hooks";
import { barClient } from "../services/client/barClient";
import type { Bar } from "../entities";

export const useBar = (id?: string | null) =>
  useDomain<Bar | undefined>(
    id ? `bar:${id}` : null,
    () => barClient.getById(id!) as Promise<Bar>,
  );
