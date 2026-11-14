// src/features/core/messaging/services/server/admin/send.ts
//
// 管理の送信(D34・D40・D41・D42・D65・D80・D85・D92)。管理者が書いた文面を送る(その場で書く連絡も、テンプレートを呼び出して直した文面も同じ形)。
// - 中身: content = 経路ごとの文面(経路の受け口の zod で検査、{{鍵}} を差し込む)・template? = 呼び出したテンプレート { templateId, version }
//   (今の公開版でなければ 409)・vars? = テンプレートの変数の値(template がある時だけ)。組み方は sendMessage/authoredDefinition.ts
// - 宛先: 全員 / ロール / audiences の受け口の項目(+ 引数)/ 選んだ利用者(userIds)
// - カテゴリー(必須): 種別 announcement・direct・marketing のカテゴリーの鍵。宛先の種類は種別の性質 adminFreeText で確かめる
//   (./freeText.ts。誤りは 400)。鍵はその種別の authored の定義(messages/admin<Kind>.ts)
// - 経路: カテゴリーの経路の中の絞り(省略 = 全部、D86)。使う経路はどれも文面が要る(無ければ 400)。LINE・fork の経路も送れる
// - 予約: scheduledAt(ISO 8601)。過ぎた・遠すぎる時刻は送る口が 400。拾うのは cron の周期(Hobby は 1 日 1 回)
// - プレビュー: 操作した管理者を見本の受信者にして経路ごとに描く(メールは送る時と同じ描き方の HTML)
// - 見込み: 宛先の数(送る時に展開で数え直す = fixedAtSend)
// - テスト送信: 宛先 = 操作した管理者だけ、is_test(集計と分母から外す)
// - service でも管理者を確かめ、監査 messaging.dispatch.{sent, scheduled, test_sent}

import { z } from "zod";

import type { MessageAdminAudience, MessageAudience, MessageCategory, MessageChannel } from "@/lib/messaging";
import type { AuditRecordInput } from "@/lib/audit";
import { DomainError } from "@/lib/errors";

import type { AnyMessageDefinition } from "../sendMessage/definition";
import { activeChannel } from "../sendMessage/expand";
import type { MessagePreview, RecipientEstimate } from "../sendMessage/sender";
import type { MessageAudienceSpec, SendAuthoredInput, SendMessageResult, SendMessageToManyInput } from "../sendMessage/types";
import { assertAdminActor, type AdminCheckDeps } from "./assertAdmin";
import { adminFreeTextCategoryOf, adminFreeTextCategoryOptions, type AdminFreeTextCategoryOption } from "./freeText";

/** 選んだ利用者の上限 */
export const ADMIN_SEND_MAX_USERS = 10_000;
const SEND_SOURCE = "messaging.adminSend";

/** 呼び出したテンプレート(読み込んだ版。今の公開版でなければ 409) */
export const AdminMessageTemplateSchema = z
  .object({ templateId: z.string().uuid(), version: z.number().int().min(1) })
  .strict();

const audienceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("all") }).strict(),
  z.object({ type: z.literal("role"), roles: z.array(z.string().min(1)).min(1).max(50) }).strict(),
  z.object({ type: z.literal("audience"), key: z.string().min(1), args: z.unknown().optional() }).strict(),
  z.object({ type: z.literal("users"), userIds: z.array(z.string().trim().min(1)).min(1).max(ADMIN_SEND_MAX_USERS) }).strict(),
]);

/** 送る中身。/send・一括送信 bulk-send とそのプレビュー・テスト送信が同じ形を受ける */
export const adminContentFields = {
  /** 経路ごとの文面(鍵 = 経路。中の欄は経路の受け口の zod で検査する) */
  content: z.record(z.string(), z.unknown()),
  /** 呼び出したテンプレート(省略 = その場で書いた文面)。版の文面から直したかは回の template_edited */
  template: AdminMessageTemplateSchema.optional(),
  /** テンプレートの変数の値(回に 1 組。template がある時だけ) */
  vars: z.record(z.string(), z.unknown()).optional(),
  /** 送るカテゴリー(種別 announcement・direct・marketing) */
  category: z.string().trim().min(1).max(100),
  /** 送る経路(カテゴリーの経路の中の絞り。省略 = 全部。その中に文言の無い経路があれば 400) */
  channels: z.array(z.string().min(1)).min(1).max(20).optional(),
};

export function checkAdminContent(value: { template?: unknown; vars?: Record<string, unknown> }, ctx: z.RefinementCtx): void {
  if (!value.template && value.vars && Object.keys(value.vars).length > 0) {
    ctx.addIssue({ code: "custom", message: "変数の値(vars)はテンプレートを呼び出した時(template)だけ渡せます" });
  }
}

export const AdminSendInputSchema = z
  .object({
    ...adminContentFields,
    audience: audienceSchema,
    /** 予約の時刻(ISO 8601、省略 = 今送る) */
    scheduledAt: z.string().datetime({ offset: true }).optional(),
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict()
  .superRefine((value, ctx) => checkAdminContent(value, ctx));

export const AdminSendPreviewInputSchema = z
  .object({ ...adminContentFields })
  .strict()
  .superRefine((value, ctx) => checkAdminContent(value, ctx));

export const AdminSendTestInputSchema = z
  .object({ ...adminContentFields, idempotencyKey: z.string().trim().min(8).max(128).optional() })
  .strict()
  .superRefine((value, ctx) => checkAdminContent(value, ctx));

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
  channels: { key: string; label: string }[];
  roles: { id: string; label: string }[];
  audiences: { key: string; label: string }[];
  templates: {
    id: string;
    key: string;
    name: string;
    category: string;
    currentVersion: number;
    /** 今の公開版の文言(鍵 = 文言のある経路。送る画面が読み込んで送る) */
    content: Record<string, unknown>;
    variables: { key: string; label: string; type: string; required: boolean; default?: unknown; source: string }[];
  }[];
  /** 送れるカテゴリー(種別 announcement・direct・marketing、宛先の種類で絞る) */
  categories: AdminFreeTextCategoryOption[];
  /** 予約できる日数(config.schedule.maxDaysAhead) */
  maxScheduleDays: number;
};

export type AdminSendDeps = AdminCheckDeps & {
  sendAuthored: (input: SendAuthoredInput) => Promise<SendMessageResult>;
  previewMessage: (
    source:
      | { definition: AnyMessageDefinition }
      | { authored: { content: Record<string, unknown>; category: string; template?: { templateId: string; version: number } } },
    input: { vars: Record<string, unknown>; channels?: readonly string[]; userId: string | null },
  ) => Promise<MessagePreview>;
  estimateRecipients: (target: { audience: MessageAudienceSpec } | { userIds: readonly string[] }) => Promise<RecipientEstimate>;
  recordAudit: (input: AuditRecordInput) => Promise<unknown>;
  channels: Readonly<Record<string, MessageChannel>>;
  categories: Readonly<Record<string, MessageCategory>>;
  audiences: Readonly<Record<string, MessageAudience>>;
  roles: () => { id: string; label: string }[];
  listPublishedTemplates: () => Promise<AdminSendOptions["templates"]>;
  maxScheduleDays: () => number;
};

/** 中身・カテゴリーを組んで送る口へ渡すのに要る部品(/send と一括送信で共通) */
export type AdminContentDeps = Pick<
  AdminSendDeps,
  "context" | "roleCategoryOf" | "sendAuthored" | "previewMessage" | "recordAudit" | "categories"
>;

export function parseOr400<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new DomainError(parsed.error.issues[0]?.message ?? "入力値が不正です", { status: 400 });
  return parsed.data;
}

/** 送る中身(文面・テンプレート・変数)・カテゴリー・経路の絞り */
export type AdminContent = {
  content: Record<string, unknown>;
  template?: z.infer<typeof AdminMessageTemplateSchema>;
  vars?: Record<string, unknown>;
  channels?: string[];
  category: string;
};
type Content = AdminContent;

/**
 * 選んだカテゴリーを確かめる(種別・宛先の種類)。文面・経路の検査は送る口(authoredDefinition)
 * @throws DomainError(400)
 */
export function adminContentCategory(deps: AdminContentDeps, content: Content, audience: MessageAdminAudience | null): MessageCategory {
  return adminFreeTextCategoryOf(deps.categories, content.category, { audience });
}

/** 監査の metadata の中身の部分(その場で書いた / テンプレート) */
export function auditContentOf(content: Content): Record<string, unknown> {
  return content.template
    ? { source: "template", templateId: content.template.templateId, templateVersion: content.template.version }
    : { source: "adhoc" };
}

function targetOf(audience: z.infer<typeof audienceSchema>): { audience: MessageAudienceSpec } | { recipients: { userId: string }[] } {
  if (audience.type === "users") return { recipients: [...new Set(audience.userIds)].map((userId) => ({ userId })) };
  if (audience.type === "role") return { audience: { type: "role", roles: audience.roles } };
  if (audience.type === "audience") return { audience: { type: "audience", key: audience.key, args: audience.args } };
  return { audience: { type: "all" } };
}

export async function dispatchAdminContent(
  deps: AdminContentDeps,
  content: Content,
  category: MessageCategory,
  rest: Omit<SendMessageToManyInput, "vars" | "channels" | "recipients" | "audience" | "recipientVars"> &
    ({ audience: MessageAudienceSpec } | { recipients: { userId: string }[] }),
): Promise<SendMessageResult> {
  return deps.sendAuthored({
    ...(rest as Omit<SendAuthoredInput, "content" | "category">),
    content: content.content,
    category: category.key,
    ...(content.template ? { template: { templateId: content.template.templateId, version: content.template.version } } : {}),
    ...(content.vars ? { vars: content.vars } : {}),
    ...(content.channels ? { channels: content.channels } : {}),
  });
}

export function resultOf(result: SendMessageResult): AdminSendResult {
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
  const category = adminContentCategory(deps, input, input.audience.type);
  const result = await dispatchAdminContent(deps, input, category, {
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
      ...auditContentOf(input),
      category: category.key,
      kind: category.kind,
      channels: input.channels ?? null,
      audience: input.audience.type === "users" ? { type: "users", count: input.audience.userIds.length } : input.audience,
      ...(scheduledAt ? { scheduledAt: scheduledAt.toISOString() } : {}),
      status: result.status,
    },
    reason: input.reason ?? null,
  });
  return resultOf(result);
}

/**
 * 描いたプレビュー(見本の受信者 = 操作した管理者)。audience = カテゴリーを確かめる宛先の種類(null = 見ない、一括送信は "bulk")
 */
export async function previewAdminContent(
  deps: AdminContentDeps,
  rawInput: unknown,
  audience: MessageAdminAudience | null,
): Promise<MessagePreview> {
  await assertAdminActor(deps);
  const input = parseOr400(AdminSendPreviewInputSchema, rawInput);
  const userId = deps.context()?.actorId ?? null;
  const category = adminContentCategory(deps, input, audience);
  return deps.previewMessage(
    {
      authored: {
        content: input.content,
        category: category.key,
        ...(input.template ? { template: { templateId: input.template.templateId, version: input.template.version } } : {}),
      },
    },
    { vars: input.vars ?? {}, channels: input.channels, userId },
  );
}

/** 描いたプレビュー(送る画面) */
export async function adminSendPreview(deps: AdminSendDeps, rawInput: unknown): Promise<MessagePreview> {
  return previewAdminContent(deps, rawInput, null);
}

/** 宛先数の見込み(送る時に数え直す) */
export async function adminSendEstimate(deps: AdminSendDeps, rawInput: unknown): Promise<RecipientEstimate> {
  await assertAdminActor(deps);
  const { audience } = parseOr400(AdminSendEstimateInputSchema, rawInput);
  const target = targetOf(audience);
  return deps.estimateRecipients("recipients" in target ? { userIds: target.recipients.map((r) => r.userId) } : target);
}

/**
 * 自分へのテスト送信(宛先 = 操作した管理者だけ、is_test)。audience = カテゴリーを確かめる宛先の種類(送る画面 "users"・一括送信 "bulk")
 * @throws DomainError(400) 操作した利用者が無い(システムの操作)
 */
export async function testAdminContent(
  deps: AdminContentDeps,
  rawInput: unknown,
  options: { audience: MessageAdminAudience; source: string },
): Promise<AdminSendResult> {
  await assertAdminActor(deps);
  const input = parseOr400(AdminSendTestInputSchema, rawInput);
  const actorId = deps.context()?.actorId;
  if (!actorId) throw new DomainError("テスト送信の宛先(操作した管理者)がありません", { status: 400 });
  const category = adminContentCategory(deps, input, options.audience);
  const result = await dispatchAdminContent(deps, input, category, {
    recipients: [{ userId: actorId }],
    isTest: true,
    idempotencyKey: input.idempotencyKey,
    source: options.source,
  });
  await deps.recordAudit({
    targetType: "message_dispatch",
    targetId: result.dispatchId ?? "disabled",
    action: "messaging.dispatch.test_sent",
    metadata: {
      ...auditContentOf(input),
      category: category.key,
      kind: category.kind,
      channels: input.channels ?? null,
      status: result.status,
    },
  });
  return resultOf(result);
}

/** 自分へのテスト送信(送る画面。宛先は選んだ利用者(操作した管理者)と同じ扱い) */
export async function adminSendTest(deps: AdminSendDeps, rawInput: unknown): Promise<AdminSendResult> {
  return testAdminContent(deps, rawInput, { audience: "users", source: `${SEND_SOURCE}.test` });
}

/** 選択肢の経路(有効な受け口の経路・表示名は受け口の label)。送る・一括送信の両方の選択肢が使う */
export function adminChannelOptions(channels: Readonly<Record<string, MessageChannel>>): AdminSendOptions["channels"] {
  return Object.keys(channels).flatMap((key) => {
    const channel = activeChannel(channels, key);
    return channel ? [{ key, label: channel.label }] : [];
  });
}

/** 送る画面の選択肢 */
export async function adminSendOptions(deps: AdminSendDeps): Promise<AdminSendOptions> {
  await assertAdminActor(deps);
  return {
    channels: adminChannelOptions(deps.channels),
    roles: deps.roles(),
    audiences: Object.values(deps.audiences).map((audience) => ({ key: audience.key, label: audience.label })),
    templates: await deps.listPublishedTemplates(),
    // 送る画面の宛先(全員・ロール・宛先の集め方・選んだ利用者)のどれかに送れるカテゴリー
    categories: adminFreeTextCategoryOptions(deps.categories, (option) =>
      option.audiences.some((audience) => audience !== "bulk"),
    ),
    maxScheduleDays: deps.maxScheduleDays(),
  };
}
