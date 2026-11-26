// src/domains/core/auditLog/services/server/auditLogBase.ts

import { AuditLogTable } from "@/domains/core/auditLog/entities/drizzle";
import { AuditLogCreateSchema, type AuditLogCreateInput } from "@/domains/core/auditLog/entities/schema";
import { createCrudService } from "@/lib/crud/server";
import type { CrudServiceOptions } from "@/lib/crud/server";

const auditLogOptions: CrudServiceOptions<AuditLogCreateInput> = {
  idType: "uuid",
  defaultOrderBy: [["createdAt", "DESC"]],
  parseCreate: (data) => AuditLogCreateSchema.parse(data),
};

export const auditLogBase = createCrudService(AuditLogTable, auditLogOptions);
