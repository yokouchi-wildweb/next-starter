// src/domains/core/auditLog/entities/auditLogFailed/model.ts

export type AuditLogFailed = {
  id: string;
  payload: unknown;
  errorMessage: string | null;
  errorStack: string | null;
  createdAt: Date;
};
