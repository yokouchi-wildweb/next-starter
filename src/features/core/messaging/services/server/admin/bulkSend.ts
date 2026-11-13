// src/features/core/messaging/services/server/admin/bulkSend.ts
//
// 管理の一括送信(D40・D42)。連絡 messaging.adminMessage を選んだ利用者へ sendMessageToMany で送る。
// - 宛先: 利用者 id を直に({ userIds })か、受け口 bulkSendTargets の項目で選んだ記録から({ target, recordIds })
// - 種類: 既定 marketing(好みに従う)。transactional(取引)は要求で明示したときだけ、種類 operatorDirect(種別 direct)で送る
//   (指令 37 で種別ごとの定義に替わるまでの仮、send.ts の ADMIN_CHOICE_CATEGORY。選んだ利用者宛て = 一括は性質の表の bulk)
// - 宛名: enrichers/displayName.ts が受信者ごとに足す(名前が無ければ「お客様」)
// - 管理者を service でも確かめ(assertAdmin)、監査ログに 1 行(messaging.dispatch.bulk_sent)
// - afterSend: 項目の送った後の処理を送信の受け付けの直後に 1 回。投げても送信は戻さず結果に失敗として返す

import { z } from "zod";

import type { AuditRecordInput } from "@/lib/audit";
import { DomainError } from "@/lib/errors";

import { message as adminMessage } from "../../../messages/adminMessage";
import type { SendMessageResult, SendMessageToManyInput } from "../sendMessage/types";
import { assertAdminActor, type AdminCheckDeps } from "./assertAdmin";
import { ADMIN_CHOICE_CATEGORY } from "./send";
import type { AdminBulkSendCounts, AdminMessageContent, MessageBulkSendTarget } from "./types";

/** 1 回の一括送信の利用者の上限 */
export const ADMIN_BULK_SEND_MAX_RECIPIENTS = 10_000;

const idList = z.array(z.string().trim().min(1)).min(1).max(ADMIN_BULK_SEND_MAX_RECIPIENTS);

/** 管理の一括送信の入力(管理 API の body と同じ) */
export const AdminBulkSendInputSchema = z
  .object({
    /** 利用者 id を直に */
    userIds: idList.optional(),
    /** 受け口 bulkSendTargets の鍵と、その一覧で選んだ記録の id */
    target: z.string().trim().min(1).optional(),
    recordIds: idList.optional(),
    /** 種別(既定 marketing。transactional は明示したときだけ) */
    kind: z.enum(["marketing", "transactional"]).default("marketing"),
    channels: z.array(z.enum(["email", "inApp"])).min(1),
    email: z.object({ subject: z.string().trim().min(1), body: z.string().trim().min(1) }).optional(),
    inApp: z.object({ title: z.string().trim().min(1), body: z.string().trim().min(1) }).optional(),
    /** 二重送信を防ぐ鍵(クライアント発行) */
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
    /** 送り元(省略 = "<target>.bulk"、userIds なら "messaging.adminBulk") */
    source: z.string().trim().min(1).max(120).optional(),
    reason: z.string().trim().max(500).optional(),
    isTest: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    const byUsers = value.userIds !== undefined;
    const byTarget = value.target !== undefined || value.recordIds !== undefined;
    if (byUsers === byTarget || (byTarget && (!value.target || !value.recordIds))) {
      ctx.addIssue({ code: "custom", message: "宛先は userIds か target + recordIds のどちらか 1 つで指定してください" });
    }
    if (value.channels.includes("email") && !value.email) {
      ctx.addIssue({ code: "custom", message: "メールの件名・本文は必須です" });
    }
    if (value.channels.includes("inApp") && !value.inApp) {
      ctx.addIssue({ code: "custom", message: "お知らせの題・本文は必須です" });
    }
  });

export type AdminBulkSendInput = z.input<typeof AdminBulkSendInputSchema>;

export type AdminBulkSendResult = {
  dispatchId: string | null;
  status: SendMessageResult["status"];
  counts: AdminBulkSendCounts;
  /** 項目の afterSend の結果(項目に無い・userIds 指定なら null) */
  afterSend: { ok: true } | { ok: false; error: string } | null;
};

export type AdminBulkSendDeps = AdminCheckDeps & {
  targets: Readonly<Record<string, MessageBulkSendTarget>>;
  sendMessageToMany: (definition: typeof adminMessage, input: SendMessageToManyInput) => Promise<SendMessageResult>;
  recordAudit: (input: AuditRecordInput) => Promise<unknown>;
  serviceNameShort: () => string;
};

/**
 * @throws DomainError(400) 入力の誤り・知らない target・宛先が 0 人 / (403) 管理者でない
 */
export async function adminBulkSend(deps: AdminBulkSendDeps, rawInput: AdminBulkSendInput): Promise<AdminBulkSendResult> {
  await assertAdminActor(deps);
  const parsed = AdminBulkSendInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new DomainError(parsed.error.issues[0]?.message ?? "入力値が不正です", { status: 400 });
  }
  const input = parsed.data;

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

  const content: AdminMessageContent = {
    ...(input.channels.includes("email") ? { email: input.email } : {}),
    ...(input.channels.includes("inApp") ? { inApp: input.inApp } : {}),
  };
  const category = ADMIN_CHOICE_CATEGORY[input.kind];
  const definition = category ? { ...adminMessage, category } : adminMessage;
  const source = input.source ?? (target ? `${target.key}.bulk` : "messaging.adminBulk");

  const result = await deps.sendMessageToMany(definition as typeof adminMessage, {
    recipients: userIds.map((userId) => ({ userId })),
    channels: input.channels,
    vars: {
      subject: content.email?.subject ?? "",
      body: content.email?.body ?? "",
      inAppTitle: content.inApp?.title ?? "",
      inAppBody: content.inApp?.body ?? "",
      serviceNameShort: deps.serviceNameShort(),
    },
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

  let afterSend: AdminBulkSendResult["afterSend"] = null;
  if (target?.afterSend) {
    try {
      await target.afterSend({ recordIds: input.recordIds ?? [], dispatchId: result.dispatchId, counts, content });
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
      kind: input.kind,
      channels: input.channels,
      recipientCount: counts.recipientCount,
      channelCounts: counts.channelCounts,
      status: result.status,
      ...(target ? { bulkSendTarget: target.key, recordCount: input.recordIds?.length ?? 0, afterSend } : {}),
    },
    reason: input.reason ?? null,
  });

  return { dispatchId: result.dispatchId, status: result.status, counts, afterSend };
}
