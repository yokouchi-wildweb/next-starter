// src/features/__domain__/services/server/firestoreBase.ts

import { createCrudService } from "@/lib/crud/firestore";
import type { __Domain__ } from "@/features/__domain__/entities";
import { __Domain__CreateSchema, __Domain__UpdateSchema } from "@/features/__domain__/entities/schema";

const baseOptions = __serviceOptions__;

export const base = createCrudService<__Domain__>("__domains__", {
  ...baseOptions,
  parseCreate: (data) => __Domain__CreateSchema.parse(data),
  parseUpdate: (data) => __Domain__UpdateSchema.parse(data),
  parseUpsert: (data) => __Domain__CreateSchema.parse(data),
});
