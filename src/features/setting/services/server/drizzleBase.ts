// src/features/setting/services/server/drizzleBase.ts
import { settingTable } from "@/features/setting/entities/drizzle";
import { SettingUpdateSchema } from "@/features/setting/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";

export const base = createCrudService(settingTable, {
  idType: "manual",
  parseCreate: (data) => SettingUpdateSchema.parse(data),
  parseUpdate: (data) => SettingUpdateSchema.parse(data),
  parseUpsert: (data) => SettingUpdateSchema.parse(data),
});
