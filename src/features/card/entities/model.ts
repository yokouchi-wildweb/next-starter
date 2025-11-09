// src/features/card/entities/model.ts

import type { InferInsertModel } from "drizzle-orm";
import type { BaseEntity } from "@/types/entity";
import { CardTable } from "./drizzle";

export type Card = BaseEntity & {
  name: string;
  modelNumber: string | null;
  titleId: string;
  rarityId: string;
  marketPrice: number | null;
  pointValue: number | null;
  cardType: "real" | "virtual";
  state: "active" | "inactive";
  description: string | null;
  mainImageUrl: string | null;
};

export type CardWithTags = Card & {
  tagIds: string[];
};

export type CardWithRelations = Card & {
  tagIds: string[];
  seriesIds: string[];
};

export type CardWithNames = Card & {
  titleName: string;
  rarityName: string;
};

export type CardCreateData = Omit<InferInsertModel<typeof CardTable>, "id" | "createdAt" | "updatedAt"> & {
  tagIds?: string[];
  seriesIds?: string[];
};

export type CardFullInfo = CardWithRelations & CardWithNames;
