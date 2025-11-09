// src/features/__domain__/services/server/drizzleBase.ts

import { __domain__Table } from "@/features/__domain__/entities/drizzle";
import { createCrudService } from "@/lib/crud/drizzle";

export const base = createCrudService(__domain__Table, __serviceOptions__);
