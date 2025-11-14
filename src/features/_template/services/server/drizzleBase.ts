// src/features/__domain__/services/server/drizzleBase.ts

import { __Domain__Table } from "@/features/__domain__/entities/drizzle";
import { createCrudService } from "@/lib/crud/drizzle";

export const base = createCrudService(__Domain__Table, __serviceOptions__);
