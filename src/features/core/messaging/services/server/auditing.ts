// src/features/messaging/services/server/auditing.ts
//
// 受信者単位の audit_logs 書き込みヘルパー。
// 送信ジョブ単位の記録は message_dispatches、ユーザー詳細モーダルでの
// 「このユーザーに何月何日に送ったか」の追跡は audit_logs を使う、という
// 役割分担。1 ジョブ N 受信者 → audit_logs に N 行記録される。

import { auditLogger } from "@/features/core/auditLog/services/server";

import { MESSAGING_AUDIT_ACTIONS } from "../../constants/actions";
import type { MessagingRecipientResult } from "../../entities/model";

export type RecordRecipientAuditParams = {
  dispatchId: string;
  source: string;
  recipients: MessagingRecipientResult[];
  /** メッセージ送信履歴は監査ログより長めに保持する（既定 730 日） */
  retentionDays?: number;
};

/**
 * 受信者ごとに 1 行ずつ audit_logs に記録する。
 *
 * - 少なくとも 1 チャネルで成功 → action = messaging.message.sent
 * - 試行した全チャネルで失敗 → action = messaging.message.failed
 *
 * bestEffort=true で記録し、INSERT 失敗時は dead-letter に退避する
 * （送信そのものは完了しているため audit 失敗で throw すると業務が止まる）。
 */
export async function recordRecipientAudits(
  params: RecordRecipientAuditParams,
): Promise<void> {
  if (params.recipients.length === 0) return;

  const retentionDays = params.retentionDays ?? 730;
  const inputs = params.recipients.map((r) => {
    const someSucceeded = r.email.succeeded || r.inApp.succeeded;
    const someAttempted = r.email.attempted || r.inApp.attempted;
    return {
      targetType: "user" as const,
      targetId: r.userId,
      // subject_user_id を targetId と同値で明示設定。targetType='user' の場合は冗長だが、
      // upstream の actor/subject 概念分離方針に追従し、UserActivityTimeline の集約クエリ
      // (WHERE subject_user_id = $1) に確実に乗せる。
      subjectUserId: r.userId,
      action: someAttempted && someSucceeded
        ? MESSAGING_AUDIT_ACTIONS.MESSAGE_SENT
        : MESSAGING_AUDIT_ACTIONS.MESSAGE_FAILED,
      metadata: {
        dispatchId: params.dispatchId,
        source: params.source,
        channels: {
          email: r.email,
          inApp: r.inApp,
        },
      },
      retentionDays,
      bestEffort: true as const,
    };
  });

  // recordMany は内部で 1 ステートメント INSERT に集約するためバルクでも安全。
  await auditLogger.recordMany(inputs);
}
