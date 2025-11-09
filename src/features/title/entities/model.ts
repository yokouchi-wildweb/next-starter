// src/features/title/entities/model.ts

import type { BaseEntity } from "@/types/entity";

export type Title = BaseEntity & {
  name: string;
};
