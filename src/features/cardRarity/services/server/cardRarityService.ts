// src/features/cardRarity/services/server/cardRarityService.ts
import { base } from "./drizzleBase";
import { listWithTitle } from "./wrappers/listWithTitle";
import { search } from "./wrappers/search";

export const cardRarityService = {
  ...base,
  listWithTitle,
  search,
};
