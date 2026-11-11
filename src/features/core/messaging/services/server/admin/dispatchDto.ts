// src/features/core/messaging/services/server/admin/dispatchDto.ts
//
// 回・配達を管理 API へ返す形(D37)。返す項目はここ 1 か所で絞る:
// - 常に: id・鍵・種別・種類・送り元・状態・経路・件名 / 題(headings)・数・送った人・時刻・テストか
// - 本文: 回の記録の段が vars / full のときだけ(回の描いた結果 rendered と共通の vars)。配達の本文は full のときだけ、配達の vars は vars / full
//   (秘密の連絡は送る口が本文を残さないので、ここにも出ない)
// - 宛先(address): 管理 API だけが使うので出す
// - 出さない: provider の生の値(provider_message_id・事件の payload)と last_error の文(失敗は状態と reason の符号で見る)
// - 前の送る口の回(message_key が null): 件名・題は email_subject / notification_title、本文は email_body / notification_body

import type { MessageRecord } from "@/lib/messaging";

import type { MessageDelivery, MessageDispatch } from "../../../entities/model";
import type { MessageChannelCounts, MessageChannelTextMap } from "../../../entities/schema";

export type AdminDispatchSummary = {
  id: string;
  messageKey: string | null;
  kind: string | null;
  category: string | null;
  source: string;
  status: string;
  channels: string[];
  /** 経路ごとの件名・題 */
  headings: MessageChannelTextMap;
  recipientCount: number;
  channelCounts: MessageChannelCounts | null;
  actor: { id: string | null; type: string | null };
  isTest: boolean;
  createdAt: string;
  completedAt: string | null;
  scheduledAt: string | null;
  retractedAt: string | null;
};

export type AdminDispatchDetail = AdminDispatchSummary & {
  record: MessageRecord | null;
  audience: Record<string, unknown> | null;
  tags: string[];
  reason: string | null;
  metadata: Record<string, unknown> | null;
  templateId: string | null;
  templateVersion: number | null;
  /** 本文(記録の段が vars / full のときだけ。経路ごとの欄) */
  body: Record<string, unknown> | null;
  /** 共通の vars の写し(記録の段が vars / full のときだけ) */
  vars: Record<string, unknown> | null;
};

export type AdminDeliveryRow = {
  id: string;
  recipientKey: string;
  userId: string | null;
  address: string | null;
  channel: string;
  status: string;
  reason: string | null;
  attempts: number;
  provider: string | null;
  /** 宛先が複数の経路の宛先ごとの状態(provider の値と誤りの文は落とす) */
  targets: { address: string; status: string; attempts: number }[] | null;
  nextAttemptAt: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  complainedAt: string | null;
  createdAt: string;
  /** 受信者ごとの vars(回の記録の段が vars / full のとき) */
  vars: Record<string, unknown> | null;
  /** 受信者ごとの描いた本文(full のときだけ) */
  body: Record<string, unknown> | null;
};

const iso = (value: Date | null | undefined) => (value ? value.toISOString() : null);

/** 前の送る口の回か(新しい列を持たない) */
function isLegacy(row: MessageDispatch): boolean {
  return row.message_key === null;
}

function headingsOf(row: MessageDispatch): MessageChannelTextMap {
  if (row.headings) return row.headings;
  const legacy: MessageChannelTextMap = {};
  if (row.email_subject) legacy.email = row.email_subject;
  if (row.notification_title) legacy.inApp = row.notification_title;
  return legacy;
}

export function toDispatchSummary(row: MessageDispatch): AdminDispatchSummary {
  return {
    id: row.id,
    messageKey: row.message_key,
    kind: row.kind,
    category: row.category,
    source: row.source,
    status: row.status,
    channels: row.channels,
    headings: headingsOf(row),
    recipientCount: row.recipient_count,
    channelCounts: row.channel_counts,
    actor: { id: row.actor_id, type: row.actor_type },
    isTest: row.is_test,
    createdAt: row.createdAt.toISOString(),
    completedAt: iso(row.completed_at),
    scheduledAt: iso(row.scheduled_at),
    retractedAt: iso(row.retracted_at),
  };
}

/** 回の本文を返す段か */
export function keepsDispatchBody(record: MessageRecord | null): boolean {
  return record === "vars" || record === "full";
}

export function toDispatchDetail(row: MessageDispatch): AdminDispatchDetail {
  const legacyBody = isLegacy(row)
    ? {
        ...(row.email_subject || row.email_body ? { email: { subject: row.email_subject, body: row.email_body } } : {}),
        ...(row.notification_title || row.notification_body
          ? { inApp: { title: row.notification_title, body: row.notification_body } }
          : {}),
      }
    : null;
  const keep = keepsDispatchBody(row.record);
  return {
    ...toDispatchSummary(row),
    record: row.record,
    audience: row.audience,
    tags: row.tags ?? [],
    reason: row.reason,
    metadata: row.metadata,
    templateId: row.template_id,
    templateVersion: row.template_version,
    body: legacyBody && Object.keys(legacyBody).length > 0 ? legacyBody : keep ? row.rendered : null,
    vars: keep ? row.vars : null,
  };
}

export function toDeliveryRow(row: MessageDelivery, record: MessageRecord | null): AdminDeliveryRow {
  return {
    id: row.id,
    recipientKey: row.recipient_key,
    userId: row.user_id,
    address: row.address,
    channel: row.channel,
    status: row.status,
    reason: row.reason,
    attempts: row.attempts,
    provider: row.provider,
    targets: row.targets ? row.targets.map((t) => ({ address: t.address, status: t.status, attempts: t.attempts })) : null,
    nextAttemptAt: iso(row.next_attempt_at),
    sentAt: iso(row.sent_at),
    deliveredAt: iso(row.delivered_at),
    failedAt: iso(row.failed_at),
    openedAt: iso(row.opened_at),
    clickedAt: iso(row.clicked_at),
    complainedAt: iso(row.complained_at),
    createdAt: row.createdAt.toISOString(),
    vars: keepsDispatchBody(record) ? row.vars : null,
    body: record === "full" ? row.body : null,
  };
}
