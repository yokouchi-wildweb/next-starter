// src/features/messaging/services/server/dispatch.ts
//
// message_dispatches テーブルへの INSERT を集約するヘルパー。
// send / bulkSend どちらからも呼ばれる。ALS の actor 情報を取り込み、
// 送信結果を 1 行で記録する。

import { db } from "@/lib/drizzle";
import { getAuditContext } from "@/lib/audit";

import { MessageDispatchTable } from "../../entities/drizzle";
import type { MessagingChannel } from "../../constants/channels";

export type DispatchInsertParams = {
  channels: MessagingChannel[];
  emailSubject: string | null;
  emailBody: string | null;
  notificationTitle: string | null;
  notificationBody: string | null;
  recipientCount: number;
  emailSuccessCount: number;
  emailFailedCount: number;
  notificationCreated: boolean | null;
  source: string;
  reason: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * 送信ジョブを 1 行 INSERT し、生成された id を返す。
 * actor_id / actor_type は ALS から自動取得する（取得できなければ null）。
 */
export async function insertDispatch(
  params: DispatchInsertParams,
): Promise<string> {
  const ctx = getAuditContext();

  const [created] = await db
    .insert(MessageDispatchTable)
    .values({
      channels: params.channels,
      email_subject: params.emailSubject,
      email_body: params.emailBody,
      notification_title: params.notificationTitle,
      notification_body: params.notificationBody,
      recipient_count: params.recipientCount,
      email_success_count: params.emailSuccessCount,
      email_failed_count: params.emailFailedCount,
      notification_created: params.notificationCreated,
      source: params.source,
      actor_id: ctx?.actorId ?? null,
      actor_type: ctx?.actorType ?? null,
      reason: params.reason,
      metadata: params.metadata ?? null,
    })
    .returning({ id: MessageDispatchTable.id });

  return created.id;
}
