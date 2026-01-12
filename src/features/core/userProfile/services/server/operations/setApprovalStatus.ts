// src/features/core/userProfile/services/server/operations/setApprovalStatus.ts

import type { UserRoleType } from "@/features/core/user/constants";
import { updateProfile } from "./updateProfile";

/**
 * プロフィールの承認状態を更新
 *
 * - isApproved: 承認状態（true=承認, false=非承認）
 * - approvedAt: 審査日時（承認・非承認どちらでも設定される）
 * - approvalNote: 審査メモ
 *
 * 状態の判別:
 * - approvedAt = null → 未審査
 * - isApproved = true, approvedAt = timestamp → 承認済み
 * - isApproved = false, approvedAt = timestamp → 非承認（審査済み）
 */
export async function setApprovalStatus(
  userId: string,
  role: UserRoleType,
  isApproved: boolean,
  note?: string,
): Promise<Record<string, unknown> | null> {
  return updateProfile(userId, role, {
    isApproved,
    approvedAt: new Date(),
    approvalNote: note ?? null,
  });
}
