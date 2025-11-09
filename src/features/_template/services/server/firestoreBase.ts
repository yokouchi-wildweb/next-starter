// src/features/__domain__/services/server/firestoreBase.ts

import type { __Domain__ } from "@/features/__domain__/entities";
import { __Domain__CreateSchema, __Domain__UpdateSchema } from "@/features/__domain__/entities/schema";
import { createCrudService } from "@/lib/crud/firestore";

const options = __serviceOptions__;

export const base = createCrudService<__Domain__>("__domains__", {
  ...options,
  schemas: {
    create: __Domain__CreateSchema,
    update: __Domain__UpdateSchema,
    upsert: __Domain__CreateSchema,
  },
});
