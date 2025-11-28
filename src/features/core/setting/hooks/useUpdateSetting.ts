// src/features/setting/hooks/useUpdateSetting.ts

"use client";

import { useUpdateDomain } from "@/lib/crud/hooks";
import { settingClient } from "../services/client/settingClient";
import type { Setting } from "../entities";
import type { SettingUpdateFields } from "../entities/form";

export const useUpdateSetting = () =>
  useUpdateDomain<Setting, SettingUpdateFields>(
    "setting/update",
    settingClient.update,
    "setting",
  );
