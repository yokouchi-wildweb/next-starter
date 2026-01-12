// src/features/setting/entities/model.ts

import type { BaseEntity } from "@/lib/crud";
import type { SettingExtended } from "./model.extended";

export type Setting = BaseEntity &
  SettingExtended & {
    adminHeaderLogoImageUrl: string | null;
    adminHeaderLogoImageDarkUrl: string | null;
    adminListPerPage: number;
  };

