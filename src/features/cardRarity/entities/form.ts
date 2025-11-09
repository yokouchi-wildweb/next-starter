// src/features/cardRarity/entities/form.ts

import { z } from "zod";
import { CardRarityCreateSchema, CardRarityUpdateSchema } from "./schema";

export type CardRarityCreateAdditional = {
  // foo: string; フォームに追加する項目
};
export type CardRarityCreateFields = z.infer<typeof CardRarityCreateSchema> & CardRarityCreateAdditional;

export type CardRarityUpdateAdditional = {
  // foo: string; フォームに追加する項目
};
export type CardRarityUpdateFields = z.infer<typeof CardRarityUpdateSchema> & CardRarityUpdateAdditional;
