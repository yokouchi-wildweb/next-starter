// src/features/core/messaging/services/server/admin/continueSending.ts
//
// 管理の「続きを送る」(D42): 1 つの回を 1 束だけ進める(sweep の continueSending)。管理者を service でも確かめ、監査ログに 1 行

import type { AuditRecordInput } from "@/lib/audit";

import type { ContinueSendingResult } from "../sweep";
import { assertAdminActor, type AdminCheckDeps } from "./assertAdmin";

export type AdminContinueDeps = AdminCheckDeps & {
  continueSending: (dispatchId: string) => Promise<ContinueSendingResult>;
  recordAudit: (input: AuditRecordInput) => Promise<unknown>;
};

/** @throws DomainError(403) 管理者でない / (404) 回が無い / (409) 進められない状態 */
export async function adminContinueSending(deps: AdminContinueDeps, dispatchId: string): Promise<ContinueSendingResult> {
  await assertAdminActor(deps);
  const result = await deps.continueSending(dispatchId);
  await deps.recordAudit({
    targetType: "message_dispatch",
    targetId: dispatchId,
    action: "messaging.dispatch.continued",
    metadata: { ...result },
  });
  return result;
}
