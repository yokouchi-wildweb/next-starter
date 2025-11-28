// src/features/setting/services/client/settingClient.ts

import { createApiClient } from "@/lib/crud/apiClientFactory";
import type { ApiClient } from "@/lib/crud/types";
import type { Setting } from "@/features/core/setting/entities";
import type { SettingUpdateFields } from "@/features/core/setting/entities/form";

export const settingClient: ApiClient<Setting, Partial<Setting>, SettingUpdateFields> =
  createApiClient<Setting, Partial<Setting>, SettingUpdateFields>("/api/setting");
