// src/features/core/messaging/services/server/admin/bulkSend.ts
//
// 管理の一括送信(D40・D42・D80・D81、指令 40 の AMENDMENT 2)。中身は送る画面(/send)と同じ形で、選んだ利用者へ送る。
// - 宛先: 利用者 id を直に({ userIds })か、記録の宛先(持ち主のドメインの recordTargets/<名前>.ts、門番 loadRecordTarget で読む)で選んだ記録から({ target, recordIds })
// - 中身: 送る画面(/send)と同じ { origin(レイアウト { layout } か DB のテンプレート { id, version }), values, edited?, vars?, category, channels? }(D117・D171)。
//   検査も組み方も send.ts の部品と同じ(種別、宛先の種類 bulk を種別の性質 adminFreeText で、選べるレイアウト・古い版 409)。
//   予約は無い(scheduledAt は 400)
// - プレビュー・テスト送信: adminBulkSendPreview / adminBulkSendTest(送る画面と同じ。カテゴリーは bulk で送れる物)。門 messagingBroadcast に入れない
// - 選択肢: adminBulkSendOptions(GET /api/admin/messaging/bulk-send)= bulk で送れるカテゴリーと、門 messagingTemplates が開の時だけ公開中のテンプレート。
//   一覧の一括操作の既定は direct のカテゴリー(operatorDirect、D81)
// - 宛名: enrichers/displayName.ts が受信者ごとに足す(名前が無ければ「お客様」)
// - 管理者を service でも確かめ(assertAdmin)、監査ログに 1 行(messaging.dispatch.bulk_sent)
// - 記録の宛先は利用者を解くだけ(記録から埋める値は使わない)。項目の afterSend は呼ばない(送った後の処理は定義の送信の記録の入口だけ、
//   D190・D196: ./definitionSend.ts)

import { z } from "zod";

import { DomainError } from "@/lib/errors";
import type { MessageRecordTarget } from "@/lib/messaging";

import type { MessagePreview } from "../sendMessage/sender";
import type { SendMessageResult } from "../sendMessage/types";
import { assertAdminActor } from "./assertAdmin";
import { adminFreeTextCategoryOptions, type AdminFreeTextCategoryOption } from "./freeText";
import {
  adminContentFields,
  adminContentCategory,
  auditContentOf,
  checkAdminContent,
  dispatchAdminContent,
  parseOr400,
  previewAdminContent,
  testAdminContent,
  adminChannelOptions,
  adminSendLayoutOptions,
  offeredTemplates,
  type AdminContentDeps,
  type AdminSendDeps,
  type AdminSendOptions,
  type AdminSendResult,
} from "./send";
import type { AdminBulkSendCounts } from "./types";

/** 1 回の一括送信の利用者の上限 */
export const ADMIN_BULK_SEND_MAX_RECIPIENTS = 10_000;
/** 送り元の既定(userIds 指定) */
const BULK_SOURCE = "messaging.adminBulk";

const idList = z.array(z.string().trim().min(1)).min(1).max(ADMIN_BULK_SEND_MAX_RECIPIENTS);

/** 管理の一括送信の入力(管理 API の body と同じ)。中身は /send と同じ形、予約は無い */
export const AdminBulkSendInputSchema = z
  .object({
    /** 利用者 id を直に */
    userIds: idList.optional(),
    /** 記録の宛先の鍵(<ドメインのフォルダ名>.<ファイル名>)と、その一覧で選んだ記録の id */
    target: z.string().trim().min(1).optional(),
    recordIds: idList.optional(),
    /** 送る中身・カテゴリー(種別の性質 adminFreeText に bulk がある種別: direct・promotion)・送信チャンネルの絞り(送る画面と同じ) */
    ...adminContentFields,
    /** 二重送信を防ぐ鍵(クライアント発行) */
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
    /** 送り元(省略 = "<target>.bulk"、userIds なら "messaging.adminBulk") */
    source: z.string().trim().min(1).max(120).optional(),
    reason: z.string().trim().max(500).optional(),
    isTest: z.boolean().optional(),
  })
  // 知らない鍵は 400(前の body の message・kind・email・inApp、予約の scheduledAt を黙って捨てない)
  .strict()
  .superRefine((value, ctx) => {
    const byUsers = value.userIds !== undefined;
    const byTarget = value.target !== undefined || value.recordIds !== undefined;
    if (byUsers === byTarget || (byTarget && (!value.target || !value.recordIds))) {
      ctx.addIssue({ code: "custom", message: "宛先の指定が正しくありません" });
    }
    checkAdminContent(value, ctx);
  });

export type AdminBulkSendInput = z.input<typeof AdminBulkSendInputSchema>;

export type AdminBulkSendResult = {
  dispatchId: string | null;
  status: SendMessageResult["status"];
  counts: AdminBulkSendCounts;
};

export type AdminBulkSendDeps = AdminContentDeps &
  Pick<AdminSendDeps, "channels" | "layouts" | "enrichers" | "initialLayout"> & {
  /** 記録の宛先を鍵で読む(門番 loadRecordTarget を通す: 無い・閉じたドメイン・enabled() が false = null) */
  recordTarget: (key: string) => Promise<MessageRecordTarget | null>;
  /** 公開中のテンプレート(選択肢。門 messagingTemplates が開の時だけ読む) */
  listPublishedTemplates: () => Promise<AdminSendOptions["templates"]>;
  /** 門 messagingTemplates が開か */
  templatesOpen: () => boolean;
};

/**
 * @throws DomainError(400) 入力・送る口の検査・知らない target・宛先が 0 人 / (403) 管理者でない / (404・409) テンプレートの状態
 */
export async function adminBulkSend(deps: AdminBulkSendDeps, rawInput: AdminBulkSendInput): Promise<AdminBulkSendResult> {
  await assertAdminActor(deps);
  const input = parseOr400(AdminBulkSendInputSchema, rawInput);
  const category = adminContentCategory(deps, input, "bulk");

  let target: MessageRecordTarget | null = null;
  let userIds: string[];
  if (input.target) {
    target = await deps.recordTarget(input.target);
    if (!target) throw new DomainError("一括送信の対象が見つかりません", { status: 400 });
    // 記録から埋める値(vars)は定義の送信の記録の入口だけが使う。自由連絡は利用者だけ
    userIds = (await target.resolveRecipients(input.recordIds ?? [])).map((recipient) => recipient.userId);
  } else {
    userIds = input.userIds ?? [];
  }
  userIds = [...new Set(userIds)];
  if (userIds.length === 0) throw new DomainError("送信先のユーザーが見つかりませんでした", { status: 400 });
  if (userIds.length > ADMIN_BULK_SEND_MAX_RECIPIENTS) {
    throw new DomainError(`一度に送信できるのは ${ADMIN_BULK_SEND_MAX_RECIPIENTS} 人までです`, { status: 400 });
  }

  const source = input.source ?? (target ? `${target.key}.bulk` : BULK_SOURCE);
  const result = await dispatchAdminContent(deps, input, category, {
    recipients: userIds.map((userId) => ({ userId })),
    idempotencyKey: input.idempotencyKey,
    source,
    reason: input.reason,
    isTest: input.isTest,
    ...(target ? { metadata: { recordTarget: target.key, recordCount: input.recordIds?.length ?? 0 } } : {}),
  });

  const counts: AdminBulkSendCounts = {
    recipientCount: userIds.length,
    channelCounts: result.channelCounts,
    queuedCount: result.queuedCount,
  };

  await deps.recordAudit({
    targetType: "message_dispatch",
    targetId: result.dispatchId ?? "disabled",
    action: "messaging.dispatch.bulk_sent",
    metadata: {
      source,
      ...auditContentOf(input, result),
      category: category.key,
      kind: category.kind,
      channels: input.channels ?? null,
      recipientCount: counts.recipientCount,
      channelCounts: counts.channelCounts,
      status: result.status,
      ...(target ? { recordTarget: target.key, recordCount: input.recordIds?.length ?? 0 } : {}),
    },
    reason: input.reason ?? null,
  });

  return { dispatchId: result.dispatchId, status: result.status, counts };
}

/** 一括送信のプレビュー(見本の受信者 = 操作した管理者。カテゴリーは bulk で送れる物) */
export function adminBulkSendPreview(deps: AdminContentDeps, rawInput: unknown): Promise<MessagePreview> {
  return previewAdminContent(deps, rawInput, "bulk");
}

/** 一括送信の自分へのテスト送信(宛先 = 操作した管理者だけ、is_test、監査 test_sent) */
export function adminBulkSendTest(deps: AdminContentDeps, rawInput: unknown): Promise<AdminSendResult> {
  return testAdminContent(deps, rawInput, { target: "bulk", source: `${BULK_SOURCE}.test` });
}

/** 一括送信の選択肢: 送信チャンネル(表示名は受け口の label、送るモーダルと同じ)・bulk で送れるカテゴリー(種別の白紙つき = 自由連絡に使える)と、門 messagingTemplates が開の時だけ公開中のテンプレート */
export type AdminBulkSendOptions = {
  channels: AdminSendOptions["channels"];
  categories: AdminFreeTextCategoryOption[];
  templates: AdminSendOptions["templates"];
  /** 管理画面で選べるレイアウトと、並べたテンプレートが使うレイアウトの欄の宣言(send.ts adminSendLayoutOptions) */
  layouts: AdminSendOptions["layouts"];
  /** 最初に開くレイアウト(config の messaging.initialLayout、送る画面と同じ) */
  initialLayout: string;
};

export async function adminBulkSendOptions(
  deps: Pick<
    AdminBulkSendDeps,
    | "context"
    | "roleCategoryOf"
    | "channels"
    | "categories"
    | "layouts"
    | "enrichers"
    | "listPublishedTemplates"
    | "templatesOpen"
    | "initialLayout"
  >,
): Promise<AdminBulkSendOptions> {
  await assertAdminActor(deps);
  const categories = adminFreeTextCategoryOptions(deps.categories, (option) => option.targets.includes("bulk"), deps.enrichers);
  const templates = deps.templatesOpen() ? offeredTemplates(deps.layouts, await deps.listPublishedTemplates()) : [];
  return {
    channels: adminChannelOptions(deps.channels),
    categories,
    templates,
    layouts: adminSendLayoutOptions(deps.layouts, templates),
    initialLayout: deps.initialLayout(),
  };
}
