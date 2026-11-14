// src/features/core/messaging/services/server/admin/dispatchDto.ts
//
// 回・配達を管理 API へ返す形(D37)。返す項目はここ 1 か所で絞る:
// - 常に: id・鍵・種別・種類・送り元・状態・経路・件名 / 題(headings)・数・送った人・時刻・テストか
// - 本文: 回の記録の段が vars / full のときだけ(回の描いた結果 rendered と共通の vars)。配達の本文は full のときだけ、配達の vars は vars / full
//   (秘密の連絡は送る口が本文を残さないので、ここにも出ない)
// - 宛先(address): 管理 API だけが使うので出す
// - 管理者が書いて送った文面(authored_content)と選んだ利用者の id: 「同じ内容で送る」が写すので出す(管理者だけ)
// - 出さない: provider の生の値(provider_message_id・事件の payload)と last_error の文。失敗は状態・reason と、last_error の符号の部分
//   (errorCode、文は constants/deliveryErrors.ts)で見る
// - 前の送る口の回(message_key が null): 件名・本文は S2 の写しが前の列から headings / rendered へ移した。記録の段(record)を持たないので、
//   本文は段に依らず rendered を返す(前の列を消す前の管理の見え方を保つ)

import type { MessageRecord } from "@/lib/messaging";

import type { MessageDelivery, MessageDispatch } from "../../../entities/model";
import type { MessageChannelCounts, MessageChannelTextMap } from "../../../entities/schema";
import type { DispatchOperationFlags } from "./operations";

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
  /** 版の文言を直して送った回か(D85) */
  templateEdited: boolean;
  /** 管理者が書いて送った文面(書いた文面の回だけ、ほかは null。経路ごとの欄、差し込む前の字) */
  content: Record<string, unknown> | null;
  /** 選んだ利用者に送った回の利用者 id(「同じ内容で送る」の写し)。ほかの宛先の形・多すぎる回は null */
  audienceUserIds: string[] | null;
  /** 送り元の表示名(受け口 sources に表示名がある時だけ。画面は送り元の鍵を見せない、D46) */
  sourceLabel: string | null;
  /** 送った人の名前(利用者なら users.name、system なら null。画面は id でなくこれを出す、D46) */
  actorName: string | null;
  /** 本文(記録の段が vars / full のときだけ。経路ごとの欄) */
  body: Record<string, unknown> | null;
  /** 共通の vars の写し(記録の段が vars / full のときだけ) */
  vars: Record<string, unknown> | null;
  /** 管理の操作ができるか(取り消し・取り下げ・再送、できない時は理由の符号)。一覧には無い */
  operations: DispatchOperationFlags;
};

export type AdminDeliveryRow = {
  id: string;
  recipientKey: string;
  userId: string | null;
  /** 利用者の名前(users.name。無い・消えた利用者は null。画面は id でなくこれを出す、D46) */
  userName: string | null;
  address: string | null;
  channel: string;
  status: string;
  reason: string | null;
  /** 失敗の理由の符号(last_error の「符号: 文」の符号だけ。文は constants/deliveryErrors.ts、無い・形の違う値は null) */
  errorCode: string | null;
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

/** 前の送る口の回か(定義の鍵と記録の段を持たない) */
function isOldSend(row: MessageDispatch): boolean {
  return row.message_key === null;
}

/** 経路ごとの件名・題 */
export function headingsOf(row: Pick<MessageDispatch, "headings">): MessageChannelTextMap {
  return row.headings ?? {};
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

export function toDispatchDetail(
  row: MessageDispatch,
  operations: DispatchOperationFlags,
  extras: { audienceUserIds?: string[] | null; sourceLabel?: string | null; actorName?: string | null } = {},
): AdminDispatchDetail {
  const { audienceUserIds = null, sourceLabel = null, actorName = null } = extras;
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
    templateEdited: row.template_edited,
    content: (row.authored_content as Record<string, unknown> | null) ?? null,
    audienceUserIds,
    sourceLabel,
    actorName,
    // 前の送る口の回は記録の段を持たない(写しが前の列の本文を rendered へ移した)→ 段に依らず返す
    body: isOldSend(row) || keep ? row.rendered : null,
    vars: keep ? row.vars : null,
    operations,
  };
}

const ERROR_CODE = /^[a-z][a-z0-9_]{0,63}$/;

/** last_error から符号の部分だけ(provider の文は落とす)。送れた行は null */
export function deliveryErrorCode(row: Pick<MessageDelivery, "status" | "last_error">): string | null {
  if (row.status === "sent" || row.status === "delivered" || !row.last_error) return null;
  const code = row.last_error.split(":")[0]!.trim();
  return ERROR_CODE.test(code) ? code : null;
}

export function toDeliveryRow(row: MessageDelivery, record: MessageRecord | null, userName: string | null = null): AdminDeliveryRow {
  return {
    id: row.id,
    recipientKey: row.recipient_key,
    userId: row.user_id,
    userName,
    address: row.address,
    channel: row.channel,
    status: row.status,
    reason: row.reason,
    errorCode: deliveryErrorCode(row),
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
