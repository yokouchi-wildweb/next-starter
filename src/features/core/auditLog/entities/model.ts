// src/features/core/auditLog/entities/model.ts

import type { AuditActorType } from "@/features/core/auditLog/constants";

export type AuditLog = {
  id: string;
  targetType: string;
  targetId: string;
  /**
   * 「この操作が誰のユーザーに対するものか」を表す集約キー（"data subject"）。
   * target_type='user' なら targetId と同値、関連エンティティ（wallet 等）ならそのユーザー ID、
   * 対象ユーザーが特定できない bulk aggregate やシステム設定変更では null。
   */
  subjectUserId: string | null;
  actorId: string | null;
  actorType: AuditActorType;
  action: string;
  beforeValue: Record<string, unknown> | null;
  afterValue: Record<string, unknown> | null;
  context: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  reason: string | null;
  retentionDays: number;
  /**
   * バッチ記録 (recordMany / recordManyDiff) の場合に共通発番される UUID。
   * 単件記録 (record / recordDiff) では null。
   */
  batchId: string | null;
  createdAt: Date;
};

export type AuditLogFailed = {
  id: string;
  payload: unknown;
  errorMessage: string | null;
  errorStack: string | null;
  createdAt: Date;
};
