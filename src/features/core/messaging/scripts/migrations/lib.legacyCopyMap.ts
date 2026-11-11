// src/features/core/messaging/scripts/migrations/lib.legacyCopyMap.ts
//
// 旧お知らせの写し(copy-legacy-notifications)の列の対応。DB に触らない純粋な関数だけ(本物の置き場もテストの置き場もこれで写す)。
// - 新しい行の id は写し元の id から決める(回 = お知らせの id、共有の行 = お知らせの id、宛先ごとの行 = md5(お知らせの id:利用者の id)、
//   テンプレート = 古い id)。だから INSERT … ON CONFLICT DO NOTHING で何度写しても同じ結果になり、写した行は写し元に結び付く
// - 画像の台帳の行は回(messaging.dispatch / 回の id = お知らせの id / inApp.image)へ付け替える(lib.legacyCopyStore の images の段)
// - 対応の決まり: ../../README.md「旧お知らせの写し」

import { createHash } from "node:crypto";

import { isStorageRef } from "@/lib/storage";

import { MESSAGE_EXPAND_DONE, MessageTemplateVariablesSchema, type MessageChannelCount, type MessageTemplateVariable } from "../../entities/schema";
import { INBOX_IMAGES_METADATA_KEY } from "../../services/server/inbox/imageBinding";

/** 写した回の source(analytics は受け取り箱の既読の数だけに使う) */
export const LEGACY_DISPATCH_SOURCE = "legacy.notification";
/** 写した回の tags */
export const LEGACY_DISPATCH_TAG = "legacy";
/** 写したテンプレートの key の頭 */
export const LEGACY_TEMPLATE_KEY_PREFIX = "legacy-";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** uuid の形か(古い target_user_ids は text[] なので形の崩れた値があり得る) */
export const isUuid = (value: string): boolean => UUID_RE.test(value);

/**
 * 宛先ごとのお知らせの行の id(md5(<お知らせの id>:<利用者の id>) を uuid の形に)。
 * SQL の md5(<nid>::text || ':' || <uid>::text)::uuid と同じ値(既読の写しの NOT EXISTS が使う)
 */
export function legacyRecipientItemId(notificationId: string, userId: string): string {
  const hex = createHash("md5").update(`${notificationId.toLowerCase()}:${userId.toLowerCase()}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** お知らせ(notifications)のある既読が行き着くお知らせの行の id(個人宛ては読んだ人の行) */
export function legacyReadItemId(notificationId: string, targetType: LegacyTargetType, userId: string): string {
  return targetType === "individual" ? legacyRecipientItemId(notificationId, userId) : notificationId;
}

// ---- 写し元の行 ----

export type LegacyTargetType = "all" | "role" | "individual";

export type LegacyTemplateRow = {
  id: string;
  name: string;
  title: string;
  body: string;
  variables: unknown;
  category: "system" | "manual";
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type LegacyNotificationRow = {
  id: string;
  notificationTemplateId: string | null;
  title: string | null;
  body: string;
  image: string | null;
  targetType: LegacyTargetType;
  targetUserIds: string[] | null;
  targetRoles: string[] | null;
  senderType: "admin" | "system";
  createdById: string | null;
  metadata: Record<string, unknown> | null;
  isSilent: boolean;
  publishedAt: Date;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type LegacyReadRow = { notificationId: string; userId: string; readAt: Date; targetType: LegacyTargetType };

export type LegacyReadStateRow = { userId: string; readWatermarkAt: Date | null; updatedAt: Date | null };

/** 古い送る口の回の行(同じ表の古い列。新しい列を埋める) */
export type LegacyDispatchRow = {
  id: string;
  channels: string[];
  emailSubject: string | null;
  emailBody: string | null;
  notificationTitle: string | null;
  notificationBody: string | null;
  recipientCount: number;
  emailSuccessCount: number;
  emailFailedCount: number;
  notificationCreated: boolean | null;
};

// ---- 写し先の行 ----

export type TemplateInsert = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  channels: string[];
  content: { inApp: { title: string; body: string } };
  variables: MessageTemplateVariable[];
  status: "draft";
  current_version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type TemplateVersionInsert = {
  template_id: string;
  version: number;
  content: TemplateInsert["content"];
  variables: MessageTemplateVariable[];
  category: string;
  channels: string[];
  createdAt: Date;
};

export type DispatchInsert = {
  id: string;
  status: "completed";
  channels: string[];
  recipient_count: number;
  source: string;
  actor_id: string | null;
  actor_type: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  completed_at: Date;
  template_id: string | null;
  audience: Record<string, unknown>;
  tags: string[];
  channel_counts: Record<string, MessageChannelCount>;
  headings: Record<string, string>;
  show_to_later_signups: false;
  expand_cursor: string;
  updatedAt: Date;
};

export type ItemInsert = {
  id: string;
  dispatch_id: string;
  user_id: string | null;
  target_roles: string[] | null;
  title: string | null;
  body: string;
  image: string | null;
  metadata: Record<string, unknown>;
  published_at: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type ReadInsert = { item_id: string; user_id: string; read_at: Date };

export type ReadStateUpsert = { user_id: string; read_watermark_at: Date | null; updatedAt: Date };

export type DispatchFill = {
  id: string;
  headings: Record<string, string>;
  rendered: Record<string, unknown>;
  channel_counts: Record<string, MessageChannelCount>;
};

// ---- 対応 ----

const count = (targeted: number, sent: number, failed = 0): MessageChannelCount => ({
  targeted,
  sent,
  failed,
  skipped_no_address: 0,
  skipped_throttled: 0,
  suppressed: 0,
});

/** テンプレート: key legacy-<id>、category marketing、status draft、版 1。内容は inApp の欄だけ */
export function mapTemplate(row: LegacyTemplateRow, now: Date): { template: TemplateInsert; version: TemplateVersionInsert } {
  const parsed = MessageTemplateVariablesSchema.safeParse(row.variables ?? []);
  const variables = parsed.success ? parsed.data : [];
  const notes = [`旧お知らせのテンプレートから写した(旧 category: ${row.category})`];
  if (!parsed.success) notes.push(`旧 variables(形が合わず写していない): ${JSON.stringify(row.variables)}`);
  const content = { inApp: { title: row.title, body: row.body } };
  const createdAt = row.createdAt ?? now;
  const template: TemplateInsert = {
    id: row.id,
    key: `${LEGACY_TEMPLATE_KEY_PREFIX}${row.id}`,
    name: row.name,
    description: notes.join("\n"),
    category: "marketing",
    channels: ["inApp"],
    content,
    variables,
    status: "draft",
    current_version: 1,
    createdAt,
    updatedAt: row.updatedAt ?? createdAt,
  };
  return {
    template,
    version: { template_id: row.id, version: 1, content, variables, category: "marketing", channels: ["inApp"], createdAt },
  };
}

/**
 * お知らせ 1 行 = 回 1 つ + お知らせの行。全員・ロール宛ては共有の 1 行、個人宛ては今いる利用者ごとに 1 行
 * (消えた利用者・uuid の形でない値は写さず skippedRecipients に数える。同じ宛先の重なりは 1 行)。
 * 回は status completed・expand_cursor '~done'(新しい cron は拾わない)。公開の時刻が未来でもそのまま(受け取り箱が時刻まで隠す)
 */
export function mapNotification(
  row: LegacyNotificationRow,
  existingUserIds: ReadonlySet<string>,
  now: Date,
): { dispatch: DispatchInsert; items: ItemInsert[]; skippedRecipients: number } {
  const createdAt = row.createdAt ?? row.publishedAt;
  const updatedAt = row.updatedAt ?? createdAt;
  const itemMetadata: Record<string, unknown> = { ...(row.metadata ?? {}), legacyNotificationId: row.id };
  if (row.isSilent) itemMetadata.silent = true;
  const item = (id: string, userId: string | null, targetRoles: string[] | null): ItemInsert => ({
    id,
    dispatch_id: row.id,
    user_id: userId,
    target_roles: targetRoles,
    title: row.title,
    body: row.body,
    image: row.image,
    metadata: itemMetadata,
    published_at: row.publishedAt,
    createdAt,
    updatedAt,
  });

  let items: ItemInsert[];
  let audience: Record<string, unknown>;
  let skippedRecipients = 0;
  if (row.targetType === "individual") {
    const unique = [...new Set((row.targetUserIds ?? []).map((id) => id.toLowerCase()))];
    const valid = unique.filter((id) => isUuid(id) && existingUserIds.has(id));
    skippedRecipients = unique.length - valid.length;
    items = valid.map((userId) => item(legacyRecipientItemId(row.id, userId), userId, null));
    audience = { type: "recipients", count: valid.length };
  } else if (row.targetType === "role") {
    const roles = row.targetRoles ?? [];
    items = [item(row.id, null, roles)];
    audience = { type: "role", roles };
  } else {
    items = [item(row.id, null, null)];
    audience = { type: "all" };
  }
  const recipientCount = row.targetType === "individual" ? items.length : 0;

  return {
    dispatch: {
      id: row.id,
      status: "completed",
      channels: ["inApp"],
      recipient_count: recipientCount,
      source: LEGACY_DISPATCH_SOURCE,
      actor_id: row.createdById,
      actor_type: row.senderType,
      // 画像(storage://)の台帳の行は images の段が古いお知らせの行からこの回へ付け替える(同じ id)。保持の掃除が外せるよう対応を残す
      metadata: {
        legacyNotificationId: row.id,
        ...(isStorageRef(row.image) ? { [INBOX_IMAGES_METADATA_KEY]: { [row.image]: row.image } } : {}),
      },
      createdAt,
      completed_at: row.publishedAt,
      template_id: row.notificationTemplateId,
      audience,
      tags: [LEGACY_DISPATCH_TAG],
      channel_counts: { inApp: count(recipientCount, recipientCount) },
      headings: row.title ? { inApp: row.title } : {},
      show_to_later_signups: false,
      expand_cursor: MESSAGE_EXPAND_DONE,
      updatedAt: updatedAt ?? now,
    },
    items,
    skippedRecipients,
  };
}

/** 既読: お知らせの行へ(個人宛ては読んだ人の行) */
export function mapRead(row: LegacyReadRow): ReadInsert {
  return { item_id: legacyReadItemId(row.notificationId, row.targetType, row.userId), user_id: row.userId, read_at: row.readAt };
}

/** 全部既読の watermark はそのまま(写し先に新しい値があれば大きい方。置き場が GREATEST で書く) */
export function mapReadState(row: LegacyReadStateRow, now: Date): ReadStateUpsert {
  return { user_id: row.userId, read_watermark_at: row.readWatermarkAt, updatedAt: row.updatedAt ?? now };
}

/**
 * 古い送る口の回の古い列 → 同じ行の新しい列。
 * - headings: { email: email_subject, inApp: notification_title }
 * - rendered: { email: { subject, paragraphs: [email_body] }, inApp: { title, body } }(経路の欄の形)
 * - channel_counts: email = 対象 recipient_count・成功・失敗、inApp = 作られていれば対象 = 送った = recipient_count
 * status・expand_cursor は触らない(sweep は message_key の無い行を拾わない)
 */
export function mapDispatchFill(row: LegacyDispatchRow): DispatchFill {
  const headings: Record<string, string> = {};
  const rendered: Record<string, unknown> = {};
  const channelCounts: Record<string, MessageChannelCount> = {};
  const usesEmail = row.channels.includes("email") || row.emailSubject !== null || row.emailBody !== null;
  const usesInApp = row.channels.includes("inApp") || row.notificationCreated !== null;
  if (usesEmail) {
    if (row.emailSubject) headings.email = row.emailSubject;
    if (row.emailSubject || row.emailBody) {
      rendered.email = {
        ...(row.emailSubject ? { subject: row.emailSubject } : {}),
        ...(row.emailBody ? { paragraphs: [row.emailBody] } : {}),
      };
    }
    channelCounts.email = count(row.recipientCount, row.emailSuccessCount, row.emailFailedCount);
  }
  if (usesInApp) {
    if (row.notificationTitle) headings.inApp = row.notificationTitle;
    if (row.notificationTitle || row.notificationBody) {
      rendered.inApp = {
        ...(row.notificationTitle ? { title: row.notificationTitle } : {}),
        ...(row.notificationBody !== null ? { body: row.notificationBody } : {}),
      };
    }
    const sent = row.notificationCreated ? row.recipientCount : 0;
    channelCounts.inApp = count(row.recipientCount, sent, row.notificationCreated === false ? row.recipientCount : 0);
  }
  return { id: row.id, headings, rendered, channel_counts: channelCounts };
}
