// src/features/sample/services/server/drizzleBase.ts

import { sampleTable } from "@/features/sample/entities/drizzle";
import { createCrudService } from "@/lib/crud/drizzle";

export const base = createCrudService(sampleTable, {
  idType: "uuid",
  useCreatedAt: true,
  useUpdatedAt: true,
  defaultSearchFields: [
    "name",
    "description"
  ],
  defaultOrderBy: [
    [
      "updatedAt",
      "DESC"
    ]
  ]
});
