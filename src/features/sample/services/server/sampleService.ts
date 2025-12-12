// src/features/sample/services/server/sampleService.ts

import { base } from "./drizzleBase";
import { remove } from "./wrappers/remove";
import { duplicate } from "./wrappers/duplicate";

export const sampleService = {
  ...base,
  remove,
  duplicate,
};
