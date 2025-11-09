// src/features/series/services/server/seriesService.ts
import { base } from "./drizzleBase";
import { listByTitle } from "./wrappers/listByTitle";

export const seriesService = {
  ...base,
  listByTitle,
};
