// src/features/core/userLoginEvent/entities/model.ts

import type { UserLoginEventType } from "@/features/core/userLoginEvent/constants";

/**
 * user_login_events の 1 レコード。
 */
export type UserLoginEvent = {
  id: string;
  userId: string;
  eventType: UserLoginEventType;
  /** PostgreSQL inet 型。代表的には "192.168.1.1" / "::1" / "2001:db8::/32" 等の文字列 */
  ip: string;
  userAgent: string | null;
  occurredAt: Date;
  retentionDays: number;
  createdAt: Date;
};
