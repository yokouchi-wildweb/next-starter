// src/features/gachaMachine/services/server/drizzleBase.ts

import { GachaMachineTable } from "@/features/gachaMachine/entities/drizzle";
import { GachaMachineCreateSchema, GachaMachineUpdateSchema } from "@/features/gachaMachine/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";

const baseOptions = {
  idType: "uuid",
  useCreatedAt: true,
  useUpdatedAt: true,
  defaultSearchFields: [
    "name"
  ],
  defaultOrderBy: [
    [
      "updatedAt",
      "DESC"
    ]
  ]
};

export const base = createCrudService(GachaMachineTable, {
  ...baseOptions,
  parseCreate: (data) => GachaMachineCreateSchema.parse(data),
  parseUpdate: (data) => GachaMachineUpdateSchema.parse(data),
  parseUpsert: (data) => GachaMachineCreateSchema.parse(data),
});
