// src/features/setting/hooks/useSetting.ts

"use client";

import { useDomain } from "@/lib/crud/hooks";
import { settingClient } from "../services/client/settingClient";
import type { Setting } from "../entities";

export const useSetting = () =>
  useDomain<Setting>("setting", () => settingClient.getById("global"));
