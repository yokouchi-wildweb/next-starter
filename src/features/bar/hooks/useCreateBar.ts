// src/features/bar/hooks/useCreateBar.ts

"use client";

import { useCreateDomain } from "@/lib/crud/hooks";
import { barClient } from "../services/client/barClient";
import type { Bar } from "../entities";
import type { BarCreateFields } from "../entities/form";

export const useCreateBar = () =>
  useCreateDomain<Bar, BarCreateFields>("bars/create", barClient.create, "bars");
