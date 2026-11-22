// src/features/core/messaging/services/server/admin/send.ts
//
// 管理の送信(D34・D40・D41・D42・D65・D80・D85・D117・D125)。どの送信も『テンプレートを選んで送る』1 つの流れ(自由連絡 = 白紙のシステムテンプレート)。
// - 中身: template = 出どころ { system: 白紙の鍵 } か { id, version }(DB のテンプレートの読み込んだ版。今の公開版でなければ 409)・
//   values = レイアウトの欄の中身({{鍵}} のまま、レイアウトの欄の zod で検査)・edited? = 版の中身から直したか(DB のテンプレートだけ。中身の違いでも付く)・
//   vars? = 専用の埋め込み情報の値 { 鍵: 値 }(DB のテンプレートの版かシステムテンプレートの宣言の型で検査、送信の embedded_values に残る)。組み方は sendMessage/templateDefinition.ts(fork のコードからは messagingService.sendTemplateMessage)
// - 宛先 target: 全員 / ロール / ユーザーグループ(groupId。門 userGroups が閉・しまった・壊れた・人数の上限は送る口が拒む)/
//   選んだ利用者(userIds)
// - カテゴリー(必須): 管理者が送れる種別(announcement・direct・promotion)のカテゴリーの鍵。宛先の種類は種別の性質 adminFreeText で確かめる
//   (./freeText.ts。誤りは 400)。白紙はカテゴリーと同じ種別の物だけ(400)
// - 送信チャンネル: カテゴリーの送信チャンネルの中の絞り(省略 = 全部、D86)。LINE・fork の送信チャンネルも送れる
// - 予約: scheduledAt(ISO 8601)。過ぎた・遠すぎる時刻は送る口が 400。拾うのは cron の周期(Hobby は 1 日 1 回)
// - プレビュー: 操作した管理者を見本の受信者にして送信チャンネルごとに描く(メールは送る時と同じ描き方の HTML)
// - 見込み: 宛先の数(送る時に展開で数え直す = fixedAtSend)。グループは一員の数と上限(memberLimit・overLimit)。
//   一員の数は利用できない利用者・送り始めより後の登録を外す前の数なので、送る時の数は少ないことがある
// - 選択肢のグループ: 使用中のグループを名前の順に(id は値としてだけ、D94)。門 userGroups が閉なら空
// - テスト送信: 宛先 = 操作した管理者だけ、is_test(集計と分母から外す)
// - service でも管理者を確かめ、監査 messaging.dispatch.{sent, scheduled, test_sent}

import { z } from "zod";

import {
  layoutVersionOf,
  type MessageAdminTarget,
  type MessageCategory,
  type MessageChannel,
  type MessageVarDeclaration,
  type MessageEnricher,
  type MessageLayout,
  type MessageLayoutFields,
  type MessageSystemTemplate,
} from "@/lib/messaging";
import type { AuditRecordInput } from "@/lib/audit";
import { DomainError } from "@/lib/errors";

import type { AnyMessageDefinition } from "../sendMessage/definition";
import { activeChannel } from "../sendMessage/expand";
import type { MessagePreview, RecipientEstimate } from "../sendMessage/sender";
import type {
  MessageTargetSpec,
  MessageTemplateRef,
  SendMessageResult,
  SendMessageToManyInput,
  SendTemplateMessageInput,
} from "../sendMessage/types";
import type { AdminChannelOption } from "../templates/dto";
import { assertAdminActor, type AdminCheckDeps } from "./assertAdmin";
import {
  adminFreeTextCategoryOf,
  adminFreeTextCategoryOptions,
  adminSystemTemplateOptions,
  type AdminFreeTextCategoryOption,
  type AdminSystemTemplateOption,
} from "./freeText";

/** 選んだ利用者の上限 */
export const ADMIN_SEND_MAX_USERS = 10_000;
const SEND_SOURCE = "messaging.adminSend";

/** 送る中身の出どころ: 白紙のシステムテンプレートの鍵か、DB のテンプレートの読み込んだ版(今の公開版でなければ 409) */
export const AdminMessageTemplateSchema = z.union([
  z.object({ system: z.string().trim().min(1).max(100) }).strict(),
  z.object({ id: z.string().uuid(), version: z.number().int().min(1) }).strict(),
]);

const targetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("all") }).strict(),
  z.object({ type: z.literal("role"), roles: z.array(z.string().min(1)).min(1).max(50) }).strict(),
  z.object({ type: z.literal("group"), groupId: z.string().uuid() }).strict(),
  z.object({ type: z.literal("users"), userIds: z.array(z.string().trim().min(1)).min(1).max(ADMIN_SEND_MAX_USERS) }).strict(),
]);

/** 送る中身。/send・一括送信 bulk-send とそのプレビュー・テスト送信が同じ形を受ける */
export const adminContentFields = {
  /** 出どころ(白紙 { system } か DB のテンプレート { id, version }) */
  template: AdminMessageTemplateSchema,
  /** レイアウトの欄の中身(白紙・DB のテンプレートの版のレイアウト。{{鍵}} / {{別名}} のまま) */
  values: z.record(z.string(), z.unknown()),
  /** 版の中身から直したか(DB のテンプレートだけ。送る口は中身の違いでも直した印を付ける) */
  edited: z.boolean().optional(),
  /** DB のテンプレートの専用の埋め込み情報の値(送信に 1 組) */
  vars: z.record(z.string(), z.unknown()).optional(),
  /** 送るカテゴリー(種別 announcement・direct・promotion) */
  category: z.string().trim().min(1).max(100),
  /** 送る送信チャンネル(カテゴリーの送信チャンネルの中の絞り。省略 = 全部。その中に文言の無い送信チャンネルがあれば 400) */
  channels: z.array(z.string().min(1)).min(1).max(20).optional(),
};

export function checkAdminContent(
  value: { template: MessageTemplateRef; vars?: Record<string, unknown>; edited?: boolean },
  ctx: z.RefinementCtx,
): void {
  if ("system" in value.template && value.edited) {
    ctx.addIssue({ code: "custom", message: "直した印はテンプレートを読み込んだ時だけ指定できます" });
  }
}

export const AdminSendInputSchema = z
  .object({
    ...adminContentFields,
    target: targetSchema,
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

export const AdminSendEstimateInputSchema = z.object({ target: targetSchema }).strict();

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

/** 送る画面のグループの選択肢(label = グループ名、kindLabel = 種類の表示名) */
export type AdminSendGroupOption = { id: string; label: string; kindLabel: string };

/** 送る画面が欄を描くレイアウト 1 つ(鍵・表示名・版・欄の宣言) */
export type AdminSendLayoutOption = { key: string; label: string; version: number; fields: MessageLayoutFields };

/** 送る画面の選択肢 */
export type AdminSendOptions = {
  channels: AdminChannelOption[];
  roles: { id: string; label: string }[];
  /** 使用中のユーザーグループ(名前の順、id は値としてだけ。門 userGroups が閉なら空) */
  groups: AdminSendGroupOption[];
  templates: {
    id: string;
    key: string;
    name: string;
    category: string;
    currentVersion: number;
    /** 今の公開版のレイアウト・レイアウトの版・欄の中身(送る画面が読み込んで送る) */
    layout: string;
    layoutVersion: number;
    values: Record<string, unknown>;
    /** 今の公開版の専用の埋め込み情報の宣言(送る画面が値を入れる) */
    vars: MessageVarDeclaration[];
  }[];
  /** 送れるカテゴリー(種別 announcement・direct・promotion、宛先の種類で絞る。その種別の既定の白紙・最初の送信方法・埋め込み情報の一覧つき) */
  categories: AdminFreeTextCategoryOption[];
  /** 使うシステムテンプレート全部(送る画面がテンプレートとして並べる。種別ごとにシンプル・リッチ、切った物は出さない、D119・D122) */
  systemTemplates: AdminSystemTemplateOption[];
  /** 白紙と並べたテンプレートが使うレイアウトの欄の宣言(門 messagingTemplates の外。送る画面はこれで欄を描く) */
  layouts: AdminSendLayoutOption[];
  /** 予約できる日数(config.schedule.maxDaysAhead) */
  maxScheduleDays: number;
};

export type AdminSendDeps = AdminCheckDeps & {
  sendTemplateMessage: (input: SendTemplateMessageInput) => Promise<SendMessageResult>;
  previewMessage: (
    source:
      | { definition: AnyMessageDefinition }
      | { template: { template: MessageTemplateRef; values: Record<string, unknown>; category: string } },
    input: { vars: Record<string, unknown>; channels?: readonly string[]; userId: string | null },
  ) => Promise<MessagePreview>;
  estimateRecipients: (target: { target: MessageTargetSpec } | { userIds: readonly string[] }) => Promise<RecipientEstimate>;
  recordAudit: (input: AuditRecordInput) => Promise<unknown>;
  channels: Readonly<Record<string, MessageChannel>>;
  categories: Readonly<Record<string, MessageCategory>>;
  /** システムテンプレートの受け口(選択肢のカテゴリーに種別の白紙を付ける) */
  systemTemplates: Readonly<Record<string, MessageSystemTemplate>>;
  /** レイアウトの受け口(選択肢の欄の宣言) */
  layouts: Readonly<Record<string, MessageLayout>>;
  /** enrichers の受け口(選択肢の埋め込み情報の一覧) */
  enrichers: Readonly<Record<string, MessageEnricher>>;
  roles: () => { id: string; label: string }[];
  /** 使用中のユーザーグループ(門 userGroups が閉なら空) */
  groupOptions: () => Promise<AdminSendGroupOption[]>;
  listPublishedTemplates: () => Promise<AdminSendOptions["templates"]>;
  maxScheduleDays: () => number;
};

/** 中身・カテゴリーを組んで送る口へ渡すのに要る部品(/send と一括送信で共通) */
export type AdminContentDeps = Pick<
  AdminSendDeps,
  "context" | "roleCategoryOf" | "sendTemplateMessage" | "previewMessage" | "recordAudit" | "categories"
>;

export function parseOr400<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new DomainError(parsed.error.issues[0]?.message ?? "入力値が不正です", { status: 400 });
  return parsed.data;
}

/** 送る中身(出どころ・欄の中身・直した印・専用の値)・カテゴリー・送信チャンネルの絞り */
export type AdminContent = {
  template: MessageTemplateRef;
  values: Record<string, unknown>;
  edited?: boolean;
  vars?: Record<string, unknown>;
  channels?: string[];
  category: string;
};
type Content = AdminContent;

/**
 * 選んだカテゴリーを確かめる(種別・宛先の種類)。白紙の種別・中身・送信チャンネルの検査は送る口(templateDefinition)
 * @throws DomainError(400)
 */
export function adminContentCategory(deps: AdminContentDeps, content: Content, target: MessageAdminTarget | null): MessageCategory {
  return adminFreeTextCategoryOf(deps.categories, content.category, { target });
}

/** 監査の metadata の中身の部分(白紙 / DB のテンプレート) */
export function auditContentOf(content: Content, result?: SendMessageResult): Record<string, unknown> {
  return "system" in content.template
    ? { source: "system", systemTemplate: content.template.system }
    : {
        source: "template",
        templateId: content.template.id,
        templateVersion: content.template.version,
        ...(result?.template ? { edited: result.template.edited } : {}),
      };
}

function targetOf(target: z.infer<typeof targetSchema>): { target: MessageTargetSpec } | { recipients: { userId: string }[] } {
  if (target.type === "users") return { recipients: [...new Set(target.userIds)].map((userId) => ({ userId })) };
  if (target.type === "role") return { target: { type: "role", roles: target.roles } };
  if (target.type === "group") return { target: { type: "group", groupId: target.groupId } };
  return { target: { type: "all" } };
}

export async function dispatchAdminContent(
  deps: AdminContentDeps,
  content: Content,
  category: MessageCategory,
  rest: Omit<SendMessageToManyInput, "vars" | "channels" | "recipients" | "target" | "recipientVars"> &
    ({ target: MessageTargetSpec } | { recipients: { userId: string }[] }),
): Promise<SendMessageResult> {
  return deps.sendTemplateMessage({
    ...(rest as Omit<SendTemplateMessageInput, "template" | "values" | "category">),
    template: content.template,
    values: content.values,
    category: category.key,
    ...(content.edited !== undefined ? { edited: content.edited } : {}),
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
  const category = adminContentCategory(deps, input, input.target.type);
  const result = await dispatchAdminContent(deps, input, category, {
    ...targetOf(input.target),
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
      ...auditContentOf(input, result),
      category: category.key,
      kind: category.kind,
      channels: input.channels ?? null,
      target: input.target.type === "users" ? { type: "users", count: input.target.userIds.length } : input.target,
      ...(scheduledAt ? { scheduledAt: scheduledAt.toISOString() } : {}),
      status: result.status,
    },
    reason: input.reason ?? null,
  });
  return resultOf(result);
}

/**
 * 描いたプレビュー(見本の受信者 = 操作した管理者)。target = カテゴリーを確かめる宛先の種類(null = 見ない、一括送信は "bulk")
 */
export async function previewAdminContent(
  deps: AdminContentDeps,
  rawInput: unknown,
  target: MessageAdminTarget | null,
): Promise<MessagePreview> {
  await assertAdminActor(deps);
  const input = parseOr400(AdminSendPreviewInputSchema, rawInput);
  const userId = deps.context()?.actorId ?? null;
  const category = adminContentCategory(deps, input, target);
  return deps.previewMessage(
    { template: { template: input.template, values: input.values, category: category.key } },
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
  const { target } = parseOr400(AdminSendEstimateInputSchema, rawInput);
  const resolved = targetOf(target);
  return deps.estimateRecipients("recipients" in resolved ? { userIds: resolved.recipients.map((r) => r.userId) } : resolved);
}

/**
 * 自分へのテスト送信(宛先 = 操作した管理者だけ、is_test)。target = カテゴリーを確かめる宛先の種類(送る画面 "users"・一括送信 "bulk")
 * @throws DomainError(400) 操作した利用者が無い(システムの操作)
 */
export async function testAdminContent(
  deps: AdminContentDeps,
  rawInput: unknown,
  options: { target: MessageAdminTarget; source: string },
): Promise<AdminSendResult> {
  await assertAdminActor(deps);
  const input = parseOr400(AdminSendTestInputSchema, rawInput);
  const actorId = deps.context()?.actorId;
  if (!actorId) throw new DomainError("テスト送信の宛先(ログイン中の管理者)が見つかりません", { status: 400 });
  const category = adminContentCategory(deps, input, options.target);
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
      ...auditContentOf(input, result),
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
  return testAdminContent(deps, rawInput, { target: "users", source: `${SEND_SOURCE}.test` });
}

/** 選択肢の送信チャンネル(有効な受け口の送信チャンネル・表示名は受け口の label)。送る・一括送信の両方の選択肢が使う */
export function adminChannelOptions(channels: Readonly<Record<string, MessageChannel>>): AdminSendOptions["channels"] {
  return Object.keys(channels).flatMap((key) => {
    const channel = activeChannel(channels, key);
    return channel ? [{ key, label: channel.label }] : [];
  });
}

/** 送る画面の選択肢 */
/** 選択肢の白紙とテンプレートが使うレイアウト(受け口に無いレイアウトは落とす。送る口がその時に断る) */
export function adminSendLayoutOptions(
  layouts: Readonly<Record<string, MessageLayout>>,
  categories: readonly AdminFreeTextCategoryOption[],
  templates: readonly { layout: string }[],
  systemTemplates: readonly { layout: string }[] = [],
): AdminSendLayoutOption[] {
  const keys = new Set<string>([
    ...categories.flatMap((option) => (option.systemTemplate ? [option.systemTemplate.layout] : [])),
    ...systemTemplates.map((template) => template.layout),
    ...templates.map((template) => template.layout),
  ]);
  return [...keys].flatMap((key) => {
    const layout = layouts[key];
    return layout ? [{ key: layout.key, label: layout.label, version: layoutVersionOf(layout), fields: layout.fields }] : [];
  });
}

export async function adminSendOptions(deps: AdminSendDeps): Promise<AdminSendOptions> {
  await assertAdminActor(deps);
  const templates = await deps.listPublishedTemplates();
  // 送る画面の宛先(全員・ロール・グループ・選んだ利用者)のどれかに送れるカテゴリー
  const categories = adminFreeTextCategoryOptions(
    deps.categories,
    deps.systemTemplates,
    (option) => option.targets.some((target) => target !== "bulk"),
    deps.enrichers,
  );
  const system = adminSystemTemplateOptions(deps.systemTemplates).filter((template) =>
    categories.some((option) => option.kind === template.kind),
  );
  return {
    channels: adminChannelOptions(deps.channels),
    roles: deps.roles(),
    groups: await deps.groupOptions(),
    templates,
    categories,
    systemTemplates: system,
    layouts: adminSendLayoutOptions(deps.layouts, categories, templates, system),
    maxScheduleDays: deps.maxScheduleDays(),
  };
}
