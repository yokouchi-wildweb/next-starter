// src/domains/core/user/types/bulkStatus.ts
// 状態のまとめての変更(userService.bulkChangeStatus、運用コマンド user:bulk-change-status、管理の API POST /api/admin/user/bulk/status)の引数と結果。
// 画面(hook useBulkChangeUserStatus)も読むので types に置く。変えてよい先の一覧は constants/status.ts の BULK_STATUS_TARGETS

import type { UserStatus } from "./index";

export type BulkChangeStatusParams = {
  userIds: string[];
  newStatus: UserStatus;
  /** 監査に残る理由(必須) */
  reason: string;
  /** この状態の人だけ変える(並びを絞るだけ。並びに無い人には届かない) */
  onlyFrom?: UserStatus;
  dryRun?: boolean;
};

export type BulkChangeStatusResult = {
  dryRun: boolean;
  /** 変えた(dryRun では変える)人 */
  changed: Array<{ userId: string; from: UserStatus }>;
  skipped: Array<{ userId: string; why: string }>;
  failed: Array<{ userId: string; error: string }>;
};
