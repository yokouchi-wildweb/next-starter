// src/features/core/messaging/services/server/admin/dispatchDto.ts
//
// 送信・配達を管理 API へ返す形(D37)。返す項目はここ 1 か所で絞る:
// - 常に: id・鍵・種別・カテゴリー・送り元・状態・送信チャンネル・件名 / 題(headings)・数・送った人・時刻・テストか
// - 本文: 送信の記録の段が vars / full のときだけ(送信の描いた結果 rendered と共通の vars)。配達の本文は full のときだけ、配達の vars は vars / full
//   (秘密の連絡は送る口が本文を残さないので、ここにも出ない)
// - 宛先(address): 管理 API だけが使うので出す
// - 送信の中身(レイアウトの鍵と版・欄の中身 values、差し込む前の字、D128)と選んだ利用者の id: 「同じ内容で送る」が写すので出す(管理者だけ)。
//   欄の中身は記録の段に従って送信に残る物だけ(meta で閉じた送信・秘密の連絡は null)
// - 出さない: provider の生の値(provider_message_id・事件の payload)と last_error の文。失敗は状態・reason と、last_error の符号の部分
//   (errorCode、文は constants/deliveryErrors.ts)で見る
// - グループ宛ての送信: targetGroup { id, name }(id は「同じ内容で送る」が開き直す値としてだけ、画面に出さない、D94・D60)。
//   名前は読む時のグループ名(しまったグループも)、門 userGroups が閉・消えたグループは null。detail.target は { type: "group" } だけ
// - 前の送る口の送信(レイアウト layout が null。テンプレートからの送信は message_key が null なので鍵では見ない): 件名・本文は S2 の写しが前の列から headings / rendered へ移した。記録の段(record)を持たないので、
//   本文は段に依らず rendered を返す(前の列を消す前の管理の見え方を保つ)

import type { MessageLayoutSummary, MessageRecord } from "@/lib/messaging";

import type { MessageDelivery, MessageDispatch } from "../../../entities/model";
import type { MessageChannelCounts, MessageChannelTextMap } from "../../../entities/schema";
import type { DispatchOperationFlags } from "./operations";

/** 送信の中身(D128): レイアウトの鍵・送った版・欄の中身 */
export type AdminDispatchContent = { layout: string; layoutVersion: number | null; values: Record<string, unknown> };

/**
 * 「同じ内容で送る」が写す物(D193)。自由連絡の送信(定義連絡の鍵が無く、レイアウトと欄の中身を残した送信)だけ。
 * template = DB のテンプレートから送った送信の出どころ(消されたテンプレートは id null、版の番号は残る)、レイアウトを直に選んだ送信は null
 */
export type AdminDispatchSameAs = AdminDispatchContent & {
  /** 送信の埋め込み情報の値(DB のテンプレートの専用の値。秘密の鍵は送る時に落としてある) */
  vars: Record<string, unknown>;
  template: { id: string | null; version: number; edited: boolean } | null;
};

export type AdminDispatchSummary = {
  id: string;
  messageKey: string | null;
  kind: string | null;
  category: string | null;
  source: string;
  status: string;
  channels: string[];
  /** 送信チャンネルごとの件名・題 */
  headings: MessageChannelTextMap;
  recipientCount: number;
  channelCounts: MessageChannelCounts | null;
  actor: { id: string | null; type: string | null };
  isTest: boolean;
  createdAt: string;
  completedAt: string | null;
  scheduledAt: string | null;
  /** 削除した時刻(D88。削除した送信は一覧に既定で出ない) */
  deletedAt: string | null;
  /** グループ宛ての送信の宛先のグループ(id は値としてだけ。名前が引けなければ null)。ほかの宛先は null */
  targetGroup: AdminDispatchTargetGroup | null;
};

export type AdminDispatchTargetGroup = { id: string; name: string | null };

export type AdminDispatchDetail = AdminDispatchSummary & {
  record: MessageRecord | null;
  target: Record<string, unknown> | null;
  tags: string[];
  reason: string | null;
  metadata: Record<string, unknown> | null;
  templateId: string | null;
  templateVersion: number | null;
  /** テンプレートからの送信で、そのテンプレートが消された(版の番号はあり template_id が null、D137)。画面は「削除されたテンプレート」と出す */
  templateDeleted: boolean;
  /** 版の文言を直した送信か(D85) */
  templateEdited: boolean;
  /** 送信の中身(レイアウトの鍵と送った版・欄の中身、差し込む前の字。詳細のプレビュー)。欄の中身を残していない送信は null */
  content: AdminDispatchContent | null;
  /** 「同じ内容で送る」の写し(自由連絡の送信だけ。定義連絡の送信・前の送る口の送信・中身を残していない送信は null、D193) */
  sameAs: AdminDispatchSameAs | null;
  /** 選んだ利用者への送信の利用者 id(「同じ内容で送る」の写し)。ほかの宛先の形・多すぎる送信は null */
  targetUserIds: string[] | null;
  /** 送り元の表示名(受け口 sources に表示名がある時だけ。画面は送り元の鍵を見せない、D46) */
  sourceLabel: string | null;
  /** 送った人の名前(利用者なら users.name、system なら null。画面は id でなくこれを出す、D46) */
  actorName: string | null;
  /** 本文(記録の段が vars / full のときだけ。送信チャンネルごとの欄) */
  body: Record<string, unknown> | null;
  /** 送信に 1 組の埋め込み情報の値(定義連絡の vars・DB のテンプレートの専用の値。記録の段が vars / full のときだけ) */
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
  /** 宛先が複数の送信チャンネルの宛先ごとの状態(provider の値と誤りの文は落とす) */
  targets: { address: string; status: string; attempts: number }[] | null;
  nextAttemptAt: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  complainedAt: string | null;
  createdAt: string;
  /** 受信者ごとの vars(送信の記録の段が vars / full のとき) */
  vars: Record<string, unknown> | null;
  /** 受信者ごとの描いた本文(full のときだけ) */
  body: Record<string, unknown> | null;
};

const iso = (value: Date | null | undefined) => (value ? value.toISOString() : null);

/** 前の送る口の送信か(レイアウトと記録の段を持たない) */
function isOldSend(row: Pick<MessageDispatch, "layout">): boolean {
  return row.layout === null;
}

/** 送信チャンネルごとの件名・題 */
export function headingsOf(row: Pick<MessageDispatch, "headings">): MessageChannelTextMap {
  return row.headings ?? {};
}

/** グループ宛ての送信のグループ id(ほかは null) */
export function targetGroupIdOf(row: Pick<MessageDispatch, "target">): string | null {
  const target = row.target as { type?: unknown; groupId?: unknown } | null;
  return target?.type === "group" && typeof target.groupId === "string" ? target.groupId : null;
}

/** groupNames = グループ id → 名前(引けた物だけ) */
export function toDispatchSummary(row: MessageDispatch, groupNames: ReadonlyMap<string, string> = new Map()): AdminDispatchSummary {
  const groupId = targetGroupIdOf(row);
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
    deletedAt: iso(row.deleted_at),
    targetGroup: groupId ? { id: groupId, name: groupNames.get(groupId) ?? null } : null,
  };
}

/** 送信の本文を返す段か */
export function keepsDispatchBody(record: MessageRecord | null): boolean {
  return record === "vars" || record === "full";
}

export function toDispatchDetail(
  row: MessageDispatch,
  operations: DispatchOperationFlags,
  extras: {
    targetUserIds?: string[] | null;
    sourceLabel?: string | null;
    actorName?: string | null;
    groupNames?: ReadonlyMap<string, string>;
  } = {},
): AdminDispatchDetail {
  const { targetUserIds = null, sourceLabel = null, actorName = null, groupNames } = extras;
  const keep = keepsDispatchBody(row.record);
  const content = row.values && row.layout ? { layout: row.layout, layoutVersion: row.layout_version ?? null, values: row.values } : null;
  return {
    ...toDispatchSummary(row, groupNames),
    record: row.record,
    // グループ宛ては宛先の形だけ(id は targetGroup に値として、固定した版は出さない)
    target: targetGroupIdOf(row) ? { type: "group" } : row.target,
    tags: row.tags ?? [],
    reason: row.reason,
    metadata: row.metadata,
    templateId: row.template_id,
    templateVersion: row.template_version,
    templateDeleted: row.template_id === null && row.template_version !== null,
    templateEdited: row.template_edited,
    content,
    sameAs: sameAsOf(row, content, keep),
    targetUserIds,
    sourceLabel,
    actorName,
    // 前の送る口の送信は記録の段を持たない(写しが前の列の本文を rendered へ移した)→ 段に依らず返す
    body: isOldSend(row) || keep ? row.rendered : null,
    vars: keep ? row.vars : null,
    operations,
  };
}

/** 「同じ内容で送る」の写し: 自由連絡(message_key が無い)で中身を残した送信だけ。値は記録の段が残す時だけ写す */
export function sameAsOf(
  row: Pick<MessageDispatch, "message_key" | "template_id" | "template_version" | "template_edited" | "vars">,
  content: AdminDispatchContent | null,
  keepVars: boolean,
): AdminDispatchSameAs | null {
  if (row.message_key !== null || !content) return null;
  return {
    ...content,
    vars: keepVars ? { ...(row.vars ?? {}) } : {},
    template: row.template_version !== null ? { id: row.template_id, version: row.template_version, edited: row.template_edited } : null,
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

/**
 * 送信のプレビューの送信チャンネル 1 つ(GET dispatches/[id]/preview)。html = メールの送った描き方の HTML(送信チャンネルに preview が無ければ null)、
 * layout / values / summary = お知らせを client のレイアウトの描き方(layoutInApps)で描く材料(差し込み済み)。描けなければ cannotRender に理由
 */
export type AdminDispatchPreviewChannel = {
  key: string;
  /** 送信チャンネルの表示名 */
  label: string;
  html: string | null;
  text: string | null;
  layout: string;
  values: Record<string, unknown>;
  summary: MessageLayoutSummary | null;
  cannotRender: string | null;
};

/** 送信のプレビュー(送信のレイアウトと欄の中身を送信の vars・埋め込み情報の値で差し込んで描く)。送信ごと描けなければ cannotRender に理由、送信チャンネルは空 */
export type AdminDispatchPreview = {
  dispatchId: string;
  layout: string | null;
  cannotRender: string | null;
  channels: AdminDispatchPreviewChannel[];
};
