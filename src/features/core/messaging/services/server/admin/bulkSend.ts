// src/features/core/messaging/services/server/admin/bulkSend.ts
//
// 管理の一括送信(D40・D42・D80・D81、指令 40 の AMENDMENT 2)。中身は送る画面(/send)と同じ形で、選んだ利用者へ送る。
// - 宛先: 利用者 id を直に({ userIds })か、受け口 bulkSendTargets の項目で選んだ記録から({ target, recordIds })
// - 中身: message = テンプレート { templateId, version, content, vars }(読み込んだ今の公開版と直した文言)か、その場で書く連絡 { email?, inApp? }。
//   カテゴリー(必須)・経路の絞り(channels?)と一緒に、検査も組み方も send.ts の部品と同じ(種別、宛先の種類 bulk を種別の性質 adminFreeText で、
//   その場で書く連絡は email・inApp の文言、テンプレートは古い版 409・文言の無い経路 400)。予約は無い(scheduledAt は 400)
// - プレビュー・テスト送信: adminBulkSendPreview / adminBulkSendTest(送る画面と同じ。カテゴリーは bulk で送れる物)。門 messagingBroadcast に入れない
// - 選択肢: adminBulkSendOptions(GET /api/admin/messaging/bulk-send)= bulk で送れるカテゴリーと、門 messagingTemplates が開の時だけ公開中のテンプレート。
//   一覧の一括操作の既定は direct のカテゴリー(operatorDirect、D81)
// - 宛名: enrichers/displayName.ts が受信者ごとに足す(名前が無ければ「お客様」)
// - 管理者を service でも確かめ(assertAdmin)、監査ログに 1 行(messaging.dispatch.bulk_sent)
// - afterSend: 項目の送った後の処理を送信の受け付けの直後に 1 回。投げても送信は戻さず結果に失敗として返す。
//   content はその場で書く連絡なら書いた中身、テンプレートなら送った文言の件名・題(差し込む前の字、本文は空)、template はテンプレートの出どころ

import { z } from "zod";

import { DomainError } from "@/lib/errors";

import type { MessagePreview } from "../sendMessage/sender";
import type { SendMessageResult } from "../sendMessage/types";
import { assertAdminActor } from "./assertAdmin";
import { adminFreeTextCategoryOptions, type AdminFreeTextCategoryOption } from "./freeText";
import {
  AdminMessageSchema,
  adminContentCategory,
  checkAdminContent,
  dispatchAdminContent,
  parseOr400,
  previewAdminContent,
  testAdminContent,
  adminChannelOptions,
  type AdminContentDeps,
  type AdminSendDeps,
  type AdminSendOptions,
  type AdminSendResult,
} from "./send";
import type { AdminBulkSendCounts, AdminBulkSendTemplate, AdminMessageContent, MessageBulkSendTarget } from "./types";

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
    /** 受け口 bulkSendTargets の鍵と、その一覧で選んだ記録の id */
    target: z.string().trim().min(1).optional(),
    recordIds: idList.optional(),
    /** 送る中身(テンプレートかその場で書く連絡) */
    message: AdminMessageSchema,
    /** 送るカテゴリー(種別の性質 adminFreeText に bulk がある種別: direct・marketing) */
    category: z.string().trim().min(1).max(100),
    /** 送る経路(カテゴリーの経路の中の絞り。省略 = 全部。その中に文言の無い経路があれば 400) */
    channels: z.array(z.string().min(1)).min(1).max(20).optional(),
    /** 二重送信を防ぐ鍵(クライアント発行) */
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
    /** 送り元(省略 = "<target>.bulk"、userIds なら "messaging.adminBulk") */
    source: z.string().trim().min(1).max(120).optional(),
    reason: z.string().trim().max(500).optional(),
    isTest: z.boolean().optional(),
  })
  // 知らない鍵は 400(前の body の kind・email・inApp、予約の scheduledAt を黙って捨てない)
  .strict()
  .superRefine((value, ctx) => {
    const byUsers = value.userIds !== undefined;
    const byTarget = value.target !== undefined || value.recordIds !== undefined;
    if (byUsers === byTarget || (byTarget && (!value.target || !value.recordIds))) {
      ctx.addIssue({ code: "custom", message: "宛先は userIds か target + recordIds のどちらか 1 つで指定してください" });
    }
    checkAdminContent(value, ctx);
  });

export type AdminBulkSendInput = z.input<typeof AdminBulkSendInputSchema>;

export type AdminBulkSendResult = {
  dispatchId: string | null;
  status: SendMessageResult["status"];
  counts: AdminBulkSendCounts;
  /** 項目の afterSend の結果(項目に無い・userIds 指定なら null) */
  afterSend: { ok: true } | { ok: false; error: string } | null;
};

export type AdminBulkSendDeps = AdminContentDeps &
  Pick<AdminSendDeps, "channels"> & {
  targets: Readonly<Record<string, MessageBulkSendTarget>>;
  /** 公開中のテンプレート(選択肢。門 messagingTemplates が開の時だけ読む) */
  listPublishedTemplates: () => Promise<AdminSendOptions["templates"]>;
  /** 門 messagingTemplates が開か */
  templatesOpen: () => boolean;
};

/** afterSend に渡す中身(項目の形)とテンプレートの出どころ */
function afterSendContentOf(
  message: z.infer<typeof AdminMessageSchema>,
  sent: SendMessageResult["template"],
): {
  content: AdminMessageContent;
  template: AdminBulkSendTemplate | null;
} {
  if (message.type === "adhoc") {
    return {
      content: { ...(message.email ? { email: message.email } : {}), ...(message.inApp ? { inApp: message.inApp } : {}) },
      template: null,
    };
  }
  const email = message.content.email as { subject?: unknown } | undefined;
  const inApp = message.content.inApp as { title?: unknown } | undefined;
  return {
    content: {
      ...(typeof email?.subject === "string" ? { email: { subject: email.subject, body: "" } } : {}),
      ...(typeof inApp?.title === "string" ? { inApp: { title: inApp.title, body: "" } } : {}),
    },
    template: { id: message.templateId, version: message.version, edited: sent?.edited ?? false },
  };
}

/**
 * @throws DomainError(400) 入力・送る口の検査・知らない target・宛先が 0 人 / (403) 管理者でない / (404・409) テンプレートの状態
 */
export async function adminBulkSend(deps: AdminBulkSendDeps, rawInput: AdminBulkSendInput): Promise<AdminBulkSendResult> {
  await assertAdminActor(deps);
  const input = parseOr400(AdminBulkSendInputSchema, rawInput);
  const category = adminContentCategory(deps, input, "bulk");

  let target: MessageBulkSendTarget | null = null;
  let userIds: string[];
  if (input.target) {
    target = deps.targets[input.target] ?? null;
    if (!target || (target.enabled && !target.enabled())) {
      throw new DomainError(`一括送信の対象 ${input.target} がありません`, { status: 400 });
    }
    userIds = await target.resolveUserIds(input.recordIds ?? []);
  } else {
    userIds = input.userIds ?? [];
  }
  userIds = [...new Set(userIds)];
  if (userIds.length === 0) throw new DomainError("送る相手が見つかりませんでした", { status: 400 });
  if (userIds.length > ADMIN_BULK_SEND_MAX_RECIPIENTS) {
    throw new DomainError(`一度に送れるのは ${ADMIN_BULK_SEND_MAX_RECIPIENTS} 人までです`, { status: 400 });
  }

  const source = input.source ?? (target ? `${target.key}.bulk` : BULK_SOURCE);
  const result = await dispatchAdminContent(deps, input, category, {
    recipients: userIds.map((userId) => ({ userId })),
    idempotencyKey: input.idempotencyKey,
    source,
    reason: input.reason,
    isTest: input.isTest,
    ...(target ? { metadata: { bulkSendTarget: target.key, recordCount: input.recordIds?.length ?? 0 } } : {}),
  });

  const counts: AdminBulkSendCounts = {
    recipientCount: userIds.length,
    channelCounts: result.channelCounts,
    queuedCount: result.queuedCount,
  };
  const { content, template } = afterSendContentOf(input.message, result.template);

  let afterSend: AdminBulkSendResult["afterSend"] = null;
  if (target?.afterSend) {
    try {
      await target.afterSend({ recordIds: input.recordIds ?? [], dispatchId: result.dispatchId, counts, content, template });
      afterSend = { ok: true };
    } catch (error) {
      afterSend = { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  await deps.recordAudit({
    targetType: "message_dispatch",
    targetId: result.dispatchId ?? "disabled",
    action: "messaging.dispatch.bulk_sent",
    metadata: {
      source,
      message: input.message.type === "template" ? "template" : "adhoc",
      ...(input.message.type === "template" ? { templateId: input.message.templateId, templateVersion: input.message.version } : {}),
      category: category.key,
      kind: category.kind,
      channels: input.channels ?? null,
      recipientCount: counts.recipientCount,
      channelCounts: counts.channelCounts,
      status: result.status,
      ...(target ? { bulkSendTarget: target.key, recordCount: input.recordIds?.length ?? 0, afterSend } : {}),
    },
    reason: input.reason ?? null,
  });

  return { dispatchId: result.dispatchId, status: result.status, counts, afterSend };
}

/** 一括送信のプレビュー(見本の受信者 = 操作した管理者。カテゴリーは bulk で送れる物) */
export function adminBulkSendPreview(deps: AdminContentDeps, rawInput: unknown): Promise<MessagePreview> {
  return previewAdminContent(deps, rawInput, "bulk");
}

/** 一括送信の自分へのテスト送信(宛先 = 操作した管理者だけ、is_test、監査 test_sent) */
export function adminBulkSendTest(deps: AdminContentDeps, rawInput: unknown): Promise<AdminSendResult> {
  return testAdminContent(deps, rawInput, { audience: "bulk", source: `${BULK_SOURCE}.test` });
}

/** 一括送信の選択肢: 経路(表示名は受け口の label、送るモーダルと同じ)・bulk で送れるカテゴリー(adhoc = その場で書く連絡に使える)と、門 messagingTemplates が開の時だけ公開中のテンプレート */
export type AdminBulkSendOptions = {
  channels: AdminSendOptions["channels"];
  categories: AdminFreeTextCategoryOption[];
  templates: AdminSendOptions["templates"];
};

export async function adminBulkSendOptions(
  deps: Pick<AdminBulkSendDeps, "context" | "roleCategoryOf" | "channels" | "categories" | "listPublishedTemplates" | "templatesOpen">,
): Promise<AdminBulkSendOptions> {
  await assertAdminActor(deps);
  return {
    channels: adminChannelOptions(deps.channels),
    categories: adminFreeTextCategoryOptions(deps.categories, (option) => option.audiences.includes("bulk")),
    templates: deps.templatesOpen() ? await deps.listPublishedTemplates() : [],
  };
}
