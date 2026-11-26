// src/domains/core/auditLog/services/server/auditLogFailedBase.ts

import { AuditLogFailedTable } from "@/domains/core/auditLog/entities/drizzle";
import { AuditLogFailedCreateSchema, type AuditLogFailedCreateInput } from "@/domains/core/auditLog/entities/schema";
import { createCrudService } from "@/lib/crud/server";
import type { CrudServiceOptions } from "@/lib/crud/server";

const auditLogFailedOptions: CrudServiceOptions<AuditLogFailedCreateInput> = {
  idType: "uuid",
  defaultOrderBy: [["createdAt", "DESC"]],
  parseCreate: (data) => AuditLogFailedCreateSchema.parse(data),
};

export const auditLogFailedBase = createCrudService(AuditLogFailedTable, auditLogFailedOptions);
