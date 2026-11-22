// src/domains/core/auditLog/services/server/drizzleBase.ts

import { AuditLogTable, AuditLogFailedTable } from "@/domains/core/auditLog/entities/drizzle";
import {
  AuditLogCreateSchema,
  AuditLogFailedCreateSchema,
  type AuditLogCreateInput,
  type AuditLogFailedCreateInput,
} from "@/domains/core/auditLog/entities/schema";
import { createCrudService } from "@/lib/crud/server";
import type { CrudServiceOptions } from "@/lib/crud/server";

const auditLogOptions: CrudServiceOptions<AuditLogCreateInput> = {
  idType: "uuid",
  defaultOrderBy: [["createdAt", "DESC"]],
  parseCreate: (data) => AuditLogCreateSchema.parse(data),
};

export const auditLogBase = createCrudService(AuditLogTable, auditLogOptions);

const auditLogFailedOptions: CrudServiceOptions<AuditLogFailedCreateInput> = {
  idType: "uuid",
  defaultOrderBy: [["createdAt", "DESC"]],
  parseCreate: (data) => AuditLogFailedCreateSchema.parse(data),
};

export const auditLogFailedBase = createCrudService(AuditLogFailedTable, auditLogFailedOptions);
