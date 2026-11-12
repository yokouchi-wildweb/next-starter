// src/features/core/messaging/services/server/admin/send.ts
//
// 管理の送信(D34・D40・D41・D42)。保存されたテンプレートか、その場で書く管理者の連絡(messaging.adminMessage)を送る。
// - 宛先: 全員 / ロール / audiences の受け口の項目(+ 引数)/ 選んだ利用者(userIds)
// - 種別: 既定 marketing(好みに従う)。transactional は選んだ利用者宛ての時だけ(全員・ロール・audiences では選べない、AMENDMENT 1)
// - 予約: scheduledAt(ISO 8601)。過ぎた・遠すぎる時刻は送る口が 400。拾うのは cron の周期(Hobby は 1 日 1 回)
// - プレビュー: 操作した管理者を見本の受信者にして経路ごとに描く(メールは送る時と同じ描き方の HTML)
// - 見込み: 宛先の数(送る時に展開で数え直す = fixedAtSend)
// - テスト送信: 宛先 = 操作した管理者だけ、is_test(集計と分母から外す)
// - service でも管理者を確かめ、監査 messaging.dispatch.{sent, scheduled, test_sent}

import { z } from "zod";

import type { MessageAudience, MessageChannel } from "@/lib/messaging";
import type { AuditRecordInput } from "@/lib/audit";
import { DomainError } from "@/lib/errors";

import { message as adminMessage } from "../../../messages/adminMessage";
import type { AnyMessageDefinition } from "../sendMessage/definition";
import { activeChannel } from "../sendMessage/expand";
import type { MessagePreview, RecipientEstimate } from "../sendMessage/sender";
import type {
  MessageAudienceSpec,
  SendMessageResult,
  SendMessageToManyInput,
  SendTemplateInput,
} from "../sendMessage/types";
import { assertAdminActor, type AdminCheckDeps } from "./assertAdmin";

/** 選んだ利用者の上限 */
export const ADMIN_SEND_MAX_USERS = 10_000;
/** その場で書く連絡の経路(adminMessage の中身がある経路) */
const ADHOC_CHANNELS = ["email", "inApp"] as const;
const SEND_SOURCE = "messaging.adminSend";

const messageSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("template"),
      templateId: z.string().uuid(),
      /** テンプレートの変数の値(回に 1 組) */
      vars: z.record(z.string(), z.unknown()).default({}),
    })
    .strict(),
  z
    .object({
      type: z.literal("adhoc"),
      email: z.object({ subject: z.string().trim().min(1), body: z.string().trim().min(1) }).strict().optional(),
      inApp: z.object({ title: z.string().trim().min(1), body: z.string().trim().min(1) }).strict().optional(),
    })
    .strict(),
]);

const audienceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("all") }).strict(),
  z.object({ type: z.literal("role"), roles: z.array(z.string().min(1)).min(1).max(50) }).strict(),
  z.object({ type: z.literal("audience"), key: z.string().min(1), args: z.unknown().optional() }).strict(),
  z.object({ type: z.literal("users"), userIds: z.array(z.string().trim().min(1)).min(1).max(ADMIN_SEND_MAX_USERS) }).strict(),
]);

const kindSchema = z.enum(["marketing", "transactional"]).default("marketing");

const contentFields = {
  message: messageSchema,
  /** 送る経路(テンプレートは省略 = 版の経路) */
  channels: z.array(z.string().min(1)).min(1).max(20).optional(),
  kind: kindSchema,
};

function checkContent(
  value: { message: z.infer<typeof messageSchema>; channels?: string[] },
  ctx: z.RefinementCtx,
): void {
  if (value.message.type !== "adhoc") return;
  const channels = value.channels ?? [];
  if (channels.length === 0) ctx.addIssue({ code: "custom", message: "送る経路を選んでください" });
  for (const key of channels) {
    if (!(ADHOC_CHANNELS as readonly string[]).includes(key)) {
      ctx.addIssue({ code: "custom", message: `その場で書く連絡は経路 ${key} に送れません(email・inApp)` });
    }
  }
  if (channels.includes("email") && !value.message.email) ctx.addIssue({ code: "custom", message: "メールの件名・本文は必須です" });
  if (channels.includes("inApp") && !value.message.inApp) ctx.addIssue({ code: "custom", message: "お知らせの題・本文は必須です" });
}

/** 取引の連絡は選んだ利用者宛てだけ(全員・ロール・audiences では選べない、D40) */
function checkKind(value: { kind: string; audience: { type: string } }, ctx: z.RefinementCtx): void {
  if (value.kind === "transactional" && value.audience.type !== "users") {
    ctx.addIssue({ code: "custom", message: "取引の連絡は選んだ利用者宛てにだけ送れます(全員・ロール・宛先の集め方では選べません)" });
  }
}

/**
 * API の入口の守り(service でも同じ検査をする): 取引の連絡を全員・ロール・audiences へ送る要求を拒む(D40)。
 * @throws DomainError(400)
 */
export function assertAdminSendKind(body: unknown): void {
  if (!body || typeof body !== "object") return;
  const { kind, audience } = body as { kind?: unknown; audience?: { type?: unknown } };
  if (kind === "transactional" && (!audience || audience.type !== "users")) {
    throw new DomainError("取引の連絡は選んだ利用者宛てにだけ送れます(全員・ロール・宛先の集め方では選べません)", { status: 400 });
  }
}

export const AdminSendInputSchema = z
  .object({
    ...contentFields,
    audience: audienceSchema,
    /** 予約の時刻(ISO 8601、省略 = 今送る) */
    scheduledAt: z.string().datetime({ offset: true }).optional(),
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    checkContent(value, ctx);
    checkKind(value, ctx);
  });

export const AdminSendPreviewInputSchema = z
  .object({ ...contentFields })
  .strict()
  .superRefine((value, ctx) => checkContent(value, ctx));

export const AdminSendTestInputSchema = z
  .object({ ...contentFields, idempotencyKey: z.string().trim().min(8).max(128).optional() })
  .strict()
  .superRefine((value, ctx) => checkContent(value, ctx));

export const AdminSendEstimateInputSchema = z.object({ audience: audienceSchema }).strict();

export type AdminSendInput = z.input<typeof AdminSendInputSchema>;
export type AdminSendPreviewInput = z.input<typeof AdminSendPreviewInputSchema>;
export type AdminSendTestInput = z.input<typeof AdminSendTestInputSchema>;
export type AdminSendEstimateInput = z.input<typeof AdminSendEstimateInputSchema>;

export type AdminSendResult = {
  dispatchId: string | null;
  status: SendMessageResult["status"];
  queuedCount: number;
  channelCounts: SendMessageResult["channelCounts"];
};

/** 送る画面の選択肢 */
export type AdminSendOptions = {
  channels: { key: string; label: string; adhoc: boolean }[];
  roles: { id: string; label: string }[];
  audiences: { key: string; label: string }[];
  templates: {
    id: string;
    key: string;
    name: string;
    category: string;
    channels: string[];
    currentVersion: number;
    variables: { key: string; label: string; type: string; required: boolean; default?: unknown; source: string }[];
  }[];
  /** 予約できる日数(config.schedule.maxDaysAhead) */
  maxScheduleDays: number;
};

export type AdminSendDeps = AdminCheckDeps & {
  sendMessageToMany: (definition: AnyMessageDefinition, input: SendMessageToManyInput) => Promise<SendMessageResult>;
  sendTemplate: (input: SendTemplateInput) => Promise<SendMessageResult>;
  previewMessage: (
    source: { definition: AnyMessageDefinition } | { templateId: string; kind?: "marketing" | "transactional" },
    input: { vars: Record<string, unknown>; channels?: readonly string[]; userId: string | null },
  ) => Promise<MessagePreview>;
  estimateRecipients: (target: { audience: MessageAudienceSpec } | { userIds: readonly string[] }) => Promise<RecipientEstimate>;
  recordAudit: (input: AuditRecordInput) => Promise<unknown>;
  serviceNameShort: () => string;
  channels: Readonly<Record<string, MessageChannel>>;
  audiences: Readonly<Record<string, MessageAudience>>;
  roles: () => { id: string; label: string }[];
  listPublishedTemplates: () => Promise<AdminSendOptions["templates"]>;
  maxScheduleDays: () => number;
};

function parseOr400<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new DomainError(parsed.error.issues[0]?.message ?? "入力値が不正です", { status: 400 });
  return parsed.data;
}

type Content = { message: z.infer<typeof messageSchema>; channels?: string[]; kind: "marketing" | "transactional" };

/** その場で書く連絡の定義と vars */
function adhocOf(deps: AdminSendDeps, content: Content & { message: { type: "adhoc" } }) {
  const definition = (content.kind === "transactional" ? { ...adminMessage, kind: "transactional" as const } : adminMessage) as
    AnyMessageDefinition;
  const vars = {
    subject: content.message.email?.subject ?? "",
    body: content.message.email?.body ?? "",
    inAppTitle: content.message.inApp?.title ?? "",
    inAppBody: content.message.inApp?.body ?? "",
    serviceNameShort: deps.serviceNameShort(),
  };
  return { definition, vars };
}

function targetOf(audience: z.infer<typeof audienceSchema>): { audience: MessageAudienceSpec } | { recipients: { userId: string }[] } {
  if (audience.type === "users") return { recipients: [...new Set(audience.userIds)].map((userId) => ({ userId })) };
  if (audience.type === "role") return { audience: { type: "role", roles: audience.roles } };
  if (audience.type === "audience") return { audience: { type: "audience", key: audience.key, args: audience.args } };
  return { audience: { type: "all" } };
}

async function dispatch(
  deps: AdminSendDeps,
  content: Content,
  rest: Omit<SendMessageToManyInput, "vars" | "channels" | "recipients" | "audience" | "recipientVars"> &
    ({ audience: MessageAudienceSpec } | { recipients: { userId: string }[] }),
): Promise<SendMessageResult> {
  if (content.message.type === "template") {
    return deps.sendTemplate({
      ...(rest as SendTemplateInput),
      templateId: content.message.templateId,
      vars: content.message.vars,
      kind: content.kind,
      ...(content.channels ? { channels: content.channels } : {}),
    });
  }
  const { definition, vars } = adhocOf(deps, content as Content & { message: { type: "adhoc" } });
  return deps.sendMessageToMany(definition, { ...rest, vars, channels: content.channels } as SendMessageToManyInput);
}

function resultOf(result: SendMessageResult): AdminSendResult {
  return { dispatchId: result.dispatchId, status: result.status, queuedCount: result.queuedCount, channelCounts: result.channelCounts };
}

/**
 * 送る(今か予約)。
 * @throws DomainError(400) 入力・送る口の検査 / (403) 管理者でない / (404・409) テンプレートの状態
 */
export async function adminSend(deps: AdminSendDeps, rawInput: unknown): Promise<AdminSendResult> {
  await assertAdminActor(deps);
  const input = parseOr400(AdminSendInputSchema, rawInput);
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : undefined;
  const result = await dispatch(deps, input, {
    ...targetOf(input.audience),
    scheduledAt,
    idempotencyKey: input.idempotencyKey,
    reason: input.reason,
    source: SEND_SOURCE,
  });
  await deps.recordAudit({
    targetType: "message_dispatch",
    targetId: result.dispatchId ?? "disabled",
    action: scheduledAt ? "messaging.dispatch.scheduled" : "messaging.dispatch.sent",
    metadata: {
      source: input.message.type === "template" ? "template" : "adhoc",
      ...(input.message.type === "template" ? { templateId: input.message.templateId } : {}),
      kind: input.kind,
      channels: input.channels ?? null,
      audience: input.audience.type === "users" ? { type: "users", count: input.audience.userIds.length } : input.audience,
      ...(scheduledAt ? { scheduledAt: scheduledAt.toISOString() } : {}),
      status: result.status,
    },
    reason: input.reason ?? null,
  });
  return resultOf(result);
}

/** 描いたプレビュー(見本の受信者 = 操作した管理者) */
export async function adminSendPreview(deps: AdminSendDeps, rawInput: unknown): Promise<MessagePreview> {
  await assertAdminActor(deps);
  const input = parseOr400(AdminSendPreviewInputSchema, rawInput);
  const userId = deps.context()?.actorId ?? null;
  if (input.message.type === "template") {
    return deps.previewMessage(
      { templateId: input.message.templateId, kind: input.kind },
      { vars: input.message.vars, channels: input.channels, userId },
    );
  }
  const { definition, vars } = adhocOf(deps, input as Content & { message: { type: "adhoc" } });
  return deps.previewMessage({ definition }, { vars, channels: input.channels, userId });
}

/** 宛先数の見込み(送る時に数え直す) */
export async function adminSendEstimate(deps: AdminSendDeps, rawInput: unknown): Promise<RecipientEstimate> {
  await assertAdminActor(deps);
  const { audience } = parseOr400(AdminSendEstimateInputSchema, rawInput);
  const target = targetOf(audience);
  return deps.estimateRecipients("recipients" in target ? { userIds: target.recipients.map((r) => r.userId) } : target);
}

/**
 * 自分へのテスト送信(宛先 = 操作した管理者だけ、is_test)。
 * @throws DomainError(400) 操作した利用者が無い(システムの操作)
 */
export async function adminSendTest(deps: AdminSendDeps, rawInput: unknown): Promise<AdminSendResult> {
  await assertAdminActor(deps);
  const input = parseOr400(AdminSendTestInputSchema, rawInput);
  const actorId = deps.context()?.actorId;
  if (!actorId) throw new DomainError("テスト送信の宛先(操作した管理者)がありません", { status: 400 });
  const result = await dispatch(deps, input, {
    recipients: [{ userId: actorId }],
    isTest: true,
    idempotencyKey: input.idempotencyKey,
    source: `${SEND_SOURCE}.test`,
  });
  await deps.recordAudit({
    targetType: "message_dispatch",
    targetId: result.dispatchId ?? "disabled",
    action: "messaging.dispatch.test_sent",
    metadata: {
      source: input.message.type === "template" ? "template" : "adhoc",
      ...(input.message.type === "template" ? { templateId: input.message.templateId } : {}),
      kind: input.kind,
      channels: input.channels ?? null,
      status: result.status,
    },
  });
  return resultOf(result);
}

/** 送る画面の選択肢 */
export async function adminSendOptions(deps: AdminSendDeps): Promise<AdminSendOptions> {
  await assertAdminActor(deps);
  const channels = Object.keys(deps.channels).flatMap((key) => {
    const channel = activeChannel(deps.channels, key);
    return channel ? [{ key, label: channel.label, adhoc: (ADHOC_CHANNELS as readonly string[]).includes(key) }] : [];
  });
  return {
    channels,
    roles: deps.roles(),
    audiences: Object.values(deps.audiences).map((audience) => ({ key: audience.key, label: audience.label })),
    templates: await deps.listPublishedTemplates(),
    maxScheduleDays: deps.maxScheduleDays(),
  };
}
