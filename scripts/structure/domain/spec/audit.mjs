// domain.json / profile.json の audit（createCrudService の audit のうち JSON で書ける部分。recorder は生成器が auditLogger を渡す）

export const AUDIT_KEYS = new Set(["enabled", "targetType", "actionPrefix", "trackedFields", "bulkMode", "retentionDays", "strict"]);
export const AUDIT_BULK_MODES = new Set(["aggregate", "detail", "off"]);

/** audit を生成物に出すか（無い・enabled: false は出さない） */
export const isAuditActive = (audit) => audit !== undefined && audit?.enabled !== false;

export const AUDIT_LOGGER_IMPORT = 'import { auditLogger } from "@/features/core/auditLog/services/server";\n';

/** createCrudService の audit オプションの値（1 行のリテラル） */
export function auditLiteral(audit) {
  const entries = Object.entries({ enabled: true, ...audit }).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
  return `{ ${entries.join(", ")}, recorder: auditLogger }`;
}
