// src/features/cardRarity/entities/model.ts

import type { InferInsertModel } from "drizzle-orm";
import type { BaseEntity } from "@/types/entity";
import { CardRarityTable } from "./drizzle";

export type CardRarity = BaseEntity & {
  titleId: string;
  name: string;
  sortOrder: number | null;
  description: string | null;
};

export type CardRarityWithTitle = CardRarity & {
  titleName: string;
};

