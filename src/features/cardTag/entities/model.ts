// src/features/cardTag/entities/model.ts

import type { BaseEntity } from "@/types/entity";

export type CardTag = BaseEntity & {
  name: string;
  description: string | null;
};

