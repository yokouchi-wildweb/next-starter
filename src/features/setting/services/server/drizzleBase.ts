// src/features/setting/services/server/drizzleBase.ts
import { settingTable } from "@/features/setting/entities/drizzle";
import { SettingUpdateSchema } from "@/features/setting/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";

const options = { idType: "manual" } as const;

export const base = createCrudService(settingTable, {
  ...options,
  schemas: {
    create: SettingUpdateSchema,
    update: SettingUpdateSchema,
    upsert: SettingUpdateSchema,
  },
});
