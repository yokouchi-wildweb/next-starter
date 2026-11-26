// src/domains/core/user/entities/userStatusHistory/model.ts

import type { UserStatusTransitionTrigger } from "../user/model";
import type { UserStatus } from "@/domains/core/user/types";

/**
 * ユーザーステータス遷移履歴の1レコード（user_status_histories）
 */
export type UserStatusHistory = {
  id: string;
  userId: string;
  /** 遷移前ステータス。新規作成（INSERT）の場合は null */
  fromStatus: UserStatus | null;
  toStatus: UserStatus;
  trigger: UserStatusTransitionTrigger;
  changedAt: Date;
};
