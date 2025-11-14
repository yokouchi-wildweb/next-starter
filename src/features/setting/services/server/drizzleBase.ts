// src/features/setting/services/server/drizzleBase.ts
import { settingTable } from "@/features/setting/entities/drizzle";
import { createCrudService } from "@/lib/crud/drizzle";

export const base = createCrudService(settingTable, { idType: "manual" });
