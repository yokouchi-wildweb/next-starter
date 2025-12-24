// src/features/setting/entities/model.ts

import type { BaseEntity } from "@/types/entity";

export type Setting = BaseEntity & {
  adminHeaderLogoImageUrl: string | null;
  adminHeaderLogoImageDarkUrl: string | null;
  adminListPerPage: number;
};

