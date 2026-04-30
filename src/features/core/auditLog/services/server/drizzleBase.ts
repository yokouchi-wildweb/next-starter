// src/features/core/auditLog/services/server/drizzleBase.ts

import { AuditLogTable, AuditLogFailedTable } from "@/features/core/auditLog/entities/drizzle";
import {
  AuditLogCreateSchema,
  AuditLogFailedCreateSchema,
  type AuditLogCreateInput,
  type AuditLogFailedCreateInput,
} from "@/features/core/auditLog/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";

const auditLogOptions: DrizzleCrudServiceOptions<AuditLogCreateInput> = {
  idType: "uuid",
  defaultOrderBy: [["createdAt", "DESC"]],
  parseCreate: (data) => AuditLogCreateSchema.parse(data),
};

export const auditLogBase = createCrudService(AuditLogTable, auditLogOptions);

const auditLogFailedOptions: DrizzleCrudServiceOptions<AuditLogFailedCreateInput> = {
  idType: "uuid",
  defaultOrderBy: [["createdAt", "DESC"]],
  parseCreate: (data) => AuditLogFailedCreateSchema.parse(data),
};

export const auditLogFailedBase = createCrudService(AuditLogFailedTable, auditLogFailedOptions);
