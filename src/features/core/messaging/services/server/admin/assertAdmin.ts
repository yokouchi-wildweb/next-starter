// src/features/core/messaging/services/server/admin/assertAdmin.ts
//
// 管理の操作の service での再検査(D42: API の access と service の両方で確かめる)。
// 監査の文脈(routeFactory が入れる)の操作者が、役割の分類 admin の利用者であること。
// runAsSystem(cron・運用コマンド)の system も通す。それ以外は 403

import { DomainError } from "@/lib/errors";
import type { AuditContext } from "@/lib/audit";

export type AdminCheckDeps = {
  /** 今の監査の文脈 */
  context: () => AuditContext | null | undefined;
  /** 利用者 id → 役割の分類(居なければ null) */
  roleCategoryOf: (userId: string) => Promise<string | null>;
};

/** @throws DomainError(403) 管理者でない */
export async function assertAdminActor(deps: AdminCheckDeps): Promise<void> {
  const context = deps.context();
  if (context?.actorType === "system") return;
  if (context?.actorId && (await deps.roleCategoryOf(context.actorId)) === "admin") return;
  throw new DomainError("この操作は管理者だけが行えます", { status: 403 });
}
