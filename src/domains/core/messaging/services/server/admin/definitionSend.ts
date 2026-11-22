// src/domains/core/messaging/services/server/admin/definitionSend.ts
//
// 定義連絡を管理者が送る(D190・D195・D196・D202・D204・D213、指令 05 の AMENDMENT 1)。自由連絡の送信(./send.ts・./bulkSend.ts)とは別の口。
// 入口は 2 つ(本文の entry):
// - 記録 { recordTarget, recordIds, message }: 記録の宛先の項目(門番 loadRecordTarget)が選んだ記録 → 宛先を解く(resolveRecipients、1 人 1 件。
//   記録ごとか、まとめるかは項目の返す形どおり、D204)。message は項目の messages の中だけ(外は 400)、定義の adminTargets に records。
//   受信者ごとの値 = 記録から埋める値(定義の recordVars の鍵だけ、定義の zod で検査)+ 管理者の値。予約は無い。門 messagingBroadcast の外
// - 全員・ロール・グループ { message, target }: 定義の adminTargets にその種類。自由連絡と同じ予約の決まり。門 messagingBroadcast の中
//   (同じ道なので門の道の印では分けられない: service が門を見て、閉なら 404。プレビュー・テストも)
// 画面から受けるのは次だけ(定義の中身はコードが持つ):
// - edits = テキストの編集(レイアウトの欄の鍵 → 値)。直せる欄は管理画面のテキストの編集と同じ(adminEditableFields)。required の連絡は受けない(400)
// - channels = 送信チャンネルの絞り(定義の固定 on はいつも入る・off とカテゴリーの外は 400、resolveChannels)。required は email を外せない
// - vars = 管理者の値(定義の adminVars の鍵だけ。入力の型で変換してから定義の vars の zod で検査、合わなければ 400)。埋まらない必須の vars は 400
// - idempotencyKey(送信は必須)
// プレビューと自分へのテスト送信は選んだ最初の記録の値で組む(見本の受信者 = 操作した管理者)。
// 送信の記録: message_key + テキストの編集の印と編集した欄(edited_fields、D202)。送り元: 記録 "<項目の鍵>.bulk"・全員など "messaging.adminSend"・テスト "<それ>.test"。
// 記録の入口は送信の受け付けの直後に項目の afterSend を 1 回(使う送信チャンネル・連絡定義・編集の後の欄・recordIds・送信の id と数、D196)。
// 投げても送信は戻さず結果と監査に失敗を残す。監査 messaging.dispatch.{sent, scheduled, test_sent}
// 人数の見込み(POST definitions/estimate、D217・指令 12 の 4): 全員・ロール・グループの入口だけ。自由連絡の見込みと同じ数え方と形
// (RecipientEstimate、停止・宛先なしを引く前)。定義の adminTargets の外は 400、門 messagingBroadcast が閉なら 404
// 選択肢(GET definitions/options、D214 (3)): 汎用の送るモーダルが組む材料。?recordTarget=<項目>(門の外)か ?entry=broadcast(門の中)で、
// 定義ごとに表示名・レイアウト・直せる欄と今の中身・管理者の値の入力・送信チャンネルの固定と初めの状態・required・許す宛先・画面の文 adminText

import { z } from "zod";

import type { AuditRecordInput } from "@/lib/audit";
import { DomainError } from "@/lib/errors";
import {
  DEFAULT_DEFINITION_ADMIN_TARGETS,
  adminEditableFields,
  adminVarValueOf,
  applyAdminFieldValues,
  channelModeOf,
  definitionChannels,
  layoutVersionOf,
  type MessageCategory,
  type MessageChannelMode,
  type MessageDefinitionAdminTarget,
  type MessageDefinitionAdminText,
  type MessageEnricher,
  type MessageLayout,
  type MessageRecordRecipient,
  type MessageRecordTarget,
  type MessageVarDeclaration,
  type MessageVarInput,
} from "@/lib/messaging";

import { resolveChannels, type AnyResolvedMessageDefinition } from "../sendMessage/definition";
import { enricherKeysFor } from "../sendMessage/enrichers";
import { userRecipientKey } from "../sendMessage/expand";
import type { MessageDefinitionSendOptions, MessagePreview, RecipientEstimate } from "../sendMessage/sender";
import type { MessageDispatchTemplateSource, MessageTargetSpec, SendMessageResult, SendMessageToManyInput } from "../sendMessage/types";
import { assertAdminActor, type AdminCheckDeps } from "./assertAdmin";
import { ADMIN_BULK_SEND_MAX_RECIPIENTS } from "./bulkSend";
import { parseOr400 } from "./send";
import type { AdminBulkSendCounts } from "./types";

/** 全員・ロール・グループの入口の送り元 */
const BROADCAST_SOURCE = "messaging.adminSend";

const messageKeySchema = z.string().trim().min(1).max(200);
const idList = z.array(z.string().trim().min(1)).min(1).max(ADMIN_BULK_SEND_MAX_RECIPIENTS);

const recordsEntrySchema = z
  .object({
    /** 記録の宛先の項目の鍵(<ドメインのフォルダ名>.<ファイル名>) */
    recordTarget: z.string().trim().min(1).max(200),
    /** 項目の一覧で選んだ記録の id */
    recordIds: idList,
    /** 送る連絡定義の鍵(項目の messages の中) */
    message: messageKeySchema,
  })
  .strict();

const broadcastTargetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("all") }).strict(),
  z.object({ type: z.literal("role"), roles: z.array(z.string().min(1)).min(1).max(50) }).strict(),
  z.object({ type: z.literal("group"), groupId: z.string().uuid() }).strict(),
]);

const broadcastEntrySchema = z.object({ message: messageKeySchema, target: broadcastTargetSchema }).strict();

/** 入口(記録か、全員・ロール・グループ) */
export const AdminDefinitionEntrySchema = z.union([recordsEntrySchema, broadcastEntrySchema]);

/** 人数の見込みの入力 = 全員・ロール・グループの入口 { message, target }(記録の入口は選んだ記録の数なので見込みは無い) */
export const AdminDefinitionEstimateInputSchema = broadcastEntrySchema;
export type AdminDefinitionEstimateInput = z.input<typeof AdminDefinitionEstimateInputSchema>;

const contentFields = {
  entry: AdminDefinitionEntrySchema,
  /** テキストの編集(レイアウトの欄の鍵 → 値。今の版の欄) */
  edits: z.record(z.string(), z.unknown()).optional(),
  /** 送信チャンネルの絞り(自由な物から選ぶ。on はいつも入る) */
  channels: z.array(z.string().min(1)).min(1).max(20).optional(),
  /** 管理者の値(定義の adminVars の鍵 → 入れた値) */
  vars: z.record(z.string(), z.unknown()).optional(),
};

export const AdminDefinitionSendInputSchema = z
  .object({
    ...contentFields,
    idempotencyKey: z.string().trim().min(8).max(128),
    /** 予約の時刻(ISO 8601。全員・ロール・グループの入口だけ) */
    scheduledAt: z.string().datetime({ offset: true }).optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.scheduledAt !== undefined && "recordTarget" in value.entry) {
      ctx.addIssue({ code: "custom", message: "記録の宛先への送信は予約できません" });
    }
  });

export const AdminDefinitionPreviewInputSchema = z.object({ ...contentFields }).strict();

export const AdminDefinitionTestInputSchema = z
  .object({ ...contentFields, idempotencyKey: z.string().trim().min(8).max(128).optional() })
  .strict();

export type AdminDefinitionEntry = z.infer<typeof AdminDefinitionEntrySchema>;
export type AdminDefinitionSendInput = z.input<typeof AdminDefinitionSendInputSchema>;
export type AdminDefinitionPreviewInput = z.input<typeof AdminDefinitionPreviewInputSchema>;
export type AdminDefinitionTestInput = z.input<typeof AdminDefinitionTestInputSchema>;

export type AdminDefinitionSendResult = {
  dispatchId: string | null;
  status: SendMessageResult["status"];
  counts: AdminBulkSendCounts;
  /** 項目の afterSend の結果(記録の入口で項目が持つ時だけ。ほかは null) */
  afterSend: { ok: true } | { ok: false; error: string } | null;
};

/** 選択肢の口の条件(どちらか 1 つ): recordTarget = 記録の入口の項目の鍵 / entry broadcast = 全員・ロール・グループの入口 */
export const AdminDefinitionOptionsQuerySchema = z
  .object({
    recordTarget: z.string().trim().min(1).max(200).optional(),
    entry: z.literal("broadcast").optional(),
  })
  .strict()
  .refine((query) => (query.recordTarget === undefined) !== (query.entry === undefined), {
    message: "recordTarget か entry=broadcast のどちらか 1 つを指定します",
  });
export type AdminDefinitionOptionsQuery = z.input<typeof AdminDefinitionOptionsQuerySchema>;

/** 定義連絡 1 本の選択肢(汎用の送るモーダルが組む材料、D214 (3)・D169・D213) */
export type AdminDefinitionOption = {
  key: string;
  /** 表示名(上書きの後) */
  label: string;
  /** レイアウトの欄の宣言(送る画面はこれで欄を描く。自由連絡の AdminSendLayoutOption と同じ形から selectable を除いた物) */
  layout: { key: string; label: string; version: number; fields: MessageLayout["fields"] };
  /** テキストの編集ができる欄(D169、管理画面のテキストの編集と同じ。required・種別が許さない = 空) */
  editableFields: string[];
  /** 直せる欄の今の中身(上書きと管理画面のテキストの編集の後。直す箱の初めの値) */
  values: Record<string, unknown>;
  /** 管理者が入れる値の入力(adminVars の鍵・別名 = varNames・入力の型) */
  adminVars: MessageVarDeclaration[];
  /** 送信チャンネルごとの固定(カテゴリーの送信チャンネル、カテゴリーの順) */
  channels: Record<string, MessageChannelMode>;
  /** 初めに入っている送信チャンネル = on ∪ (カテゴリーの defaultChannels(無い = 全部)∩ free)、カテゴリーの順(D213) */
  initialChannels: string[];
  required: boolean;
  /** 許す宛先(書いていない = ["records"]) */
  adminTargets: MessageDefinitionAdminTarget[];
  /** 画面の文(書いていない = null、画面の既定の文) */
  adminText: MessageDefinitionAdminText | null;
};

/** 選択肢の口の答え: 記録の入口は項目と並んだ定義、全員・ロール・グループの入口は定義だけ */
export type AdminDefinitionOptions =
  | { recordTarget: { key: string; label: string }; definitions: AdminDefinitionOption[] }
  | { recordTarget: null; definitions: AdminDefinitionOption[] };

export type AdminDefinitionSendDeps = AdminCheckDeps & {
  /** 連絡定義を送れる形にして読む(上書き・テキストの編集の後)。無い鍵・連絡のドメインが閉じている = null */
  loadDefinition: (messageKey: string) => Promise<AnyResolvedMessageDefinition | null>;
  /** 記録の宛先を鍵で読む(門番 loadRecordTarget を通す: 無い・閉じたドメイン・enabled() が false = null) */
  recordTarget: (key: string) => Promise<MessageRecordTarget | null>;
  /** 連絡定義の生成の一覧の鍵(絞らない。読む時に loadDefinition が閉じたドメインを落とす) */
  messageKeys: () => string[];
  /** categories の受け口(上書きの後。初めの送信チャンネル defaultChannels を引く) */
  categories: Readonly<Record<string, MessageCategory>>;
  /** 門 messagingBroadcast が開か(全員・ロール・グループの入口) */
  broadcastOpen: () => boolean;
  /** 宛先数の見込み(自由連絡の見込みと同じ数え方。送る時に数え直す) */
  estimateRecipients: (target: { target: MessageTargetSpec }) => Promise<RecipientEstimate>;
  layouts: Readonly<Record<string, MessageLayout>>;
  enrichers: Readonly<Record<string, MessageEnricher>>;
  sendResolved: (
    resolved: AnyResolvedMessageDefinition,
    input: SendMessageToManyInput,
    source?: MessageDispatchTemplateSource,
    options?: MessageDefinitionSendOptions,
  ) => Promise<SendMessageResult>;
  previewMessage: (
    source: { resolved: AnyResolvedMessageDefinition },
    input: {
      vars: Record<string, unknown>;
      channels?: readonly string[];
      userId: string | null;
      recipientVars?: Record<string, unknown>;
      recordVarKeys?: readonly string[];
    },
  ) => Promise<MessagePreview>;
  recordAudit: (input: AuditRecordInput) => Promise<unknown>;
};

type Content = z.infer<typeof AdminDefinitionPreviewInputSchema>;

/** 組んだ送信の部品(入口・定義・編集の後の定義・送信チャンネル・管理者の値・記録の値の鍵) */
type Prepared = {
  entry: AdminDefinitionEntry;
  item: MessageRecordTarget | null;
  resolved: AnyResolvedMessageDefinition;
  editedFields: string[];
  channels: string[];
  vars: Record<string, unknown>;
  recordVarKeys: string[];
};

const entryKindOf = (entry: AdminDefinitionEntry): MessageDefinitionAdminTarget =>
  "recordTarget" in entry ? "records" : entry.target.type;

/**
 * 入力から送る定義を組む(送信・プレビュー・テストで同じ検査)
 * @throws DomainError(400) 入力・並びの外・宛先の範囲の外・テキストの編集・送信チャンネル・管理者の値 / (404) 連絡定義が無い・門が閉
 */
async function prepare(deps: AdminDefinitionSendDeps, content: Content): Promise<Prepared> {
  const { entry } = content;
  if (!("recordTarget" in entry) && !deps.broadcastOpen()) {
    // 門 messagingBroadcast が閉なら全員・ロール・グループの入口は無い(閉じた道と同じ 404)
    throw new DomainError("見つかりません", { status: 404 });
  }
  let item: MessageRecordTarget | null = null;
  if ("recordTarget" in entry) {
    item = await deps.recordTarget(entry.recordTarget);
    if (!item) throw new DomainError("記録の宛先が見つかりません", { status: 400 });
    if (!item.messages.includes(entry.message)) {
      throw new DomainError(`連絡 ${entry.message} は記録の宛先 ${item.label} から送れません`, { status: 400 });
    }
  }
  const loaded = await loadForEntry(deps, entry);

  const { resolved, editedFields } = applyEdits(deps, loaded, content.edits);
  const channels = resolveChannels(resolved, content.channels);
  const vars = adminVarsOf(resolved, content.vars ?? {});
  const recordVarKeys = item ? Object.keys(resolved.recordVars ?? {}) : [];
  return { entry, item, resolved, editedFields, channels, vars, recordVarKeys };
}

/**
 * 入口の連絡定義を読み、送れるか(止められていない・adminTargets にその入口の宛先)を確かめる(送信・プレビュー・テスト・見込みで同じ)
 * @throws DomainError(404) 連絡定義が無い / (400) 止められている・宛先の範囲の外
 */
async function loadForEntry(deps: Pick<AdminDefinitionSendDeps, "loadDefinition">, entry: AdminDefinitionEntry): Promise<AnyResolvedMessageDefinition> {
  const loaded = await deps.loadDefinition(entry.message);
  if (!loaded) throw new DomainError("連絡定義が見つかりません", { status: 404 });
  if (!loaded.enabled) throw new DomainError(`連絡 ${loaded.label} は止められています`, { status: 400 });
  const kind = entryKindOf(entry);
  if (!(loaded.adminTargets ?? DEFAULT_DEFINITION_ADMIN_TARGETS).includes(kind)) {
    throw new DomainError(`連絡 ${loaded.label} はこの宛先(${kind})には送れません`, { status: 400 });
  }
  return loaded;
}

/**
 * 全員・ロール・グループの送信の人数の見込み(自由連絡の見込みと同じ RecipientEstimate、送る時に数え直す)
 * @throws DomainError(400) 入力・止められている・宛先の範囲の外 / (403) 管理者でない / (404) 連絡定義が無い・門 messagingBroadcast が閉
 */
export async function adminDefinitionEstimate(deps: AdminDefinitionSendDeps, rawInput: unknown): Promise<RecipientEstimate> {
  await assertAdminActor(deps);
  if (!deps.broadcastOpen()) throw new DomainError("見つかりません", { status: 404 });
  const entry = parseOr400(AdminDefinitionEstimateInputSchema, rawInput);
  await loadForEntry(deps, entry);
  return deps.estimateRecipients({ target: broadcastTargetOf(entry) });
}

/**
 * テキストの編集を定義の欄に重ねる(管理画面のテキストの編集と同じ検査)。編集した欄 = 値が今の欄と違う欄
 * @throws DomainError(400) required の連絡・直せない欄・値の形・使えない差し込み
 */
function applyEdits(
  deps: Pick<AdminDefinitionSendDeps, "layouts" | "enrichers">,
  resolved: AnyResolvedMessageDefinition,
  edits: Record<string, unknown> | undefined,
): { resolved: AnyResolvedMessageDefinition; editedFields: string[] } {
  const entries = Object.entries(edits ?? {});
  if (entries.length === 0) return { resolved, editedFields: [] };
  if (resolved.required) throw new DomainError(`止められない連絡のテキストは編集できません(${resolved.key})`, { status: 400 });
  const layout = deps.layouts[resolved.layout];
  if (!layout || adminEditableFields(resolved, layout).length === 0) {
    throw new DomainError(`連絡 ${resolved.label} のテキストは編集できません`, { status: 400 });
  }
  const current = (resolved.values ?? {}) as Record<string, unknown>;
  const changed = entries.filter(([fieldPath, value]) => JSON.stringify(current[fieldPath]) !== JSON.stringify(value));
  const version = layoutVersionOf(layout);
  const merged = applyAdminFieldValues(
    resolved,
    layout,
    changed.map(([fieldPath, value]) => ({ fieldPath, value, layoutVersion: version })),
    { variableKeys: enricherKeysFor(resolved, deps.enrichers) },
  );
  const [rejected] = merged.rejected;
  if (rejected) throw new DomainError(rejected.problem.message, { status: 400 });
  return { resolved: merged.resolved, editedFields: merged.applied };
}

/**
 * 管理者の値: 定義の adminVars の鍵だけ。入力の型で変換する(定義の vars の zod の検査は送る口)
 * @throws DomainError(400) 宣言に無い鍵・型の形でない
 */
function adminVarsOf(resolved: AnyResolvedMessageDefinition, raw: Record<string, unknown>): Record<string, unknown> {
  const inputs = (resolved.adminVars ?? {}) as Readonly<Record<string, MessageVarInput | undefined>>;
  const vars: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const input = inputs[key];
    if (!input) throw new DomainError(`${key} は管理者が入れる値ではありません(${resolved.key})`, { status: 400 });
    const converted = adminVarValueOf(input, value);
    if ("problem" in converted) throw new DomainError(`${key}: ${converted.problem}`, { status: 400 });
    if (converted.value !== undefined) vars[key] = converted.value;
  }
  // 書いていない adminVars の既定値
  for (const [key, input] of Object.entries(inputs)) {
    if (!input || key in vars || input.default === undefined) continue;
    const converted = adminVarValueOf(input, undefined);
    if (!("problem" in converted) && converted.value !== undefined) vars[key] = converted.value;
  }
  return vars;
}

/** 受信者 1 人の記録から埋める値(定義の recordVars の鍵だけ。ほかの鍵は項目がほかの連絡のために返した物) */
function recordVarsOf(recipient: MessageRecordRecipient, recordVarKeys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(recordVarKeys.filter((key) => key in recipient.vars).map((key) => [key, recipient.vars[key]]));
}

/**
 * 記録 → 宛先(1 人 1 件にまとめ直す: 項目が同じ人を 2 度返したら記録を足し、値は最初の物)
 * @throws DomainError(400) 宛先が 0 人・多すぎる
 */
async function recipientsOf(item: MessageRecordTarget, recordIds: readonly string[]): Promise<MessageRecordRecipient[]> {
  const byUser = new Map<string, MessageRecordRecipient>();
  for (const recipient of await item.resolveRecipients(recordIds)) {
    const seen = byUser.get(recipient.userId);
    if (seen) seen.recordIds = [...seen.recordIds, ...recipient.recordIds];
    else byUser.set(recipient.userId, { ...recipient, recordIds: [...recipient.recordIds] });
  }
  const recipients = [...byUser.values()];
  if (recipients.length === 0) throw new DomainError("送信先のユーザーが見つかりませんでした", { status: 400 });
  if (recipients.length > ADMIN_BULK_SEND_MAX_RECIPIENTS) {
    throw new DomainError(`一度に送信できるのは ${ADMIN_BULK_SEND_MAX_RECIPIENTS} 人までです`, { status: 400 });
  }
  return recipients;
}

/** 最初の記録の宛先(選んだ記録の先頭を含む物、無ければ先頭) */
function firstRecipient(recipients: readonly MessageRecordRecipient[], recordIds: readonly string[]): MessageRecordRecipient {
  return recipients.find((recipient) => recipient.recordIds.includes(recordIds[0]!)) ?? recipients[0]!;
}

function broadcastTargetOf(entry: AdminDefinitionEntry): MessageTargetSpec {
  if ("recordTarget" in entry) throw new Error("記録の入口に宛先の指定は無い");
  const { target } = entry;
  if (target.type === "role") return { type: "role", roles: target.roles };
  if (target.type === "group") return { type: "group", groupId: target.groupId };
  return { type: "all" };
}

/** 監査の metadata の共通の部分 */
function auditOf(prepared: Prepared, recordCount: number | null): Record<string, unknown> {
  return {
    message: prepared.resolved.key,
    entry: prepared.item ? { recordTarget: prepared.item.key, recordCount } : broadcastTargetOf(prepared.entry),
    editedFields: prepared.editedFields.length > 0 ? prepared.editedFields : null,
    channels: prepared.channels,
    category: prepared.resolved.category,
    kind: prepared.resolved.kind,
  };
}

/**
 * 定義連絡を送る(今か予約)。
 * @throws DomainError(400) 入力・検査 / (403) 管理者でない / (404) 連絡定義が無い・門が閉 / (409) 二重送信
 */
export async function adminDefinitionSend(deps: AdminDefinitionSendDeps, rawInput: unknown): Promise<AdminDefinitionSendResult> {
  await assertAdminActor(deps);
  const input = parseOr400(AdminDefinitionSendInputSchema, rawInput);
  const prepared = await prepare(deps, input);
  const { entry, item, resolved, editedFields, channels, vars, recordVarKeys } = prepared;
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : undefined;

  const recipients = item && "recordIds" in entry ? await recipientsOf(item, entry.recordIds) : null;
  const common = {
    vars,
    channels,
    idempotencyKey: input.idempotencyKey,
    reason: input.reason,
    ...(scheduledAt ? { scheduledAt } : {}),
  };
  const sendInput: SendMessageToManyInput = recipients
    ? {
        ...common,
        recipients: recipients.map((recipient) => ({ userId: recipient.userId })),
        recipientVars: Object.fromEntries(
          recipients.map((recipient) => [userRecipientKey(recipient.userId), recordVarsOf(recipient, recordVarKeys)]),
        ),
        source: `${item!.key}.bulk`,
        metadata: { recordTarget: item!.key, recordCount: "recordIds" in entry ? entry.recordIds.length : 0 },
      }
    : { ...common, target: broadcastTargetOf(entry), source: BROADCAST_SOURCE };
  const result = await deps.sendResolved(resolved, sendInput, undefined, { recordVarKeys, editedFields });

  const counts: AdminBulkSendCounts = {
    recipientCount: recipients ? recipients.length : 0,
    channelCounts: result.channelCounts,
    queuedCount: result.queuedCount,
  };
  const recordIds = "recordIds" in entry ? entry.recordIds : [];
  let afterSend: AdminDefinitionSendResult["afterSend"] = null;
  if (item?.afterSend) {
    try {
      await item.afterSend({
        recordIds,
        dispatchId: result.dispatchId,
        counts,
        channels,
        message: resolved.key,
        fields: { ...((resolved.values ?? {}) as Record<string, unknown>) },
      });
      afterSend = { ok: true };
    } catch (error) {
      afterSend = { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  await deps.recordAudit({
    targetType: "message_dispatch",
    targetId: result.dispatchId ?? "disabled",
    action: scheduledAt ? "messaging.dispatch.scheduled" : "messaging.dispatch.sent",
    metadata: {
      ...auditOf(prepared, item ? recordIds.length : null),
      ...(recipients ? { recipientCount: recipients.length } : {}),
      ...(scheduledAt ? { scheduledAt: scheduledAt.toISOString() } : {}),
      status: result.status,
      ...(item ? { afterSend } : {}),
    },
    reason: input.reason ?? null,
  });
  return { dispatchId: result.dispatchId, status: result.status, counts, afterSend };
}

/**
 * 描いたプレビュー(見本の受信者 = 操作した管理者。記録の入口は選んだ最初の記録の値で組む)
 * @throws DomainError 送る時と同じ検査
 */
export async function adminDefinitionPreview(deps: AdminDefinitionSendDeps, rawInput: unknown): Promise<MessagePreview> {
  await assertAdminActor(deps);
  const input = parseOr400(AdminDefinitionPreviewInputSchema, rawInput);
  const prepared = await prepare(deps, input);
  const recipientVars = await firstRecordVars(prepared);
  return deps.previewMessage(
    { resolved: prepared.resolved },
    {
      vars: prepared.vars,
      channels: prepared.channels,
      userId: deps.context()?.actorId ?? null,
      ...(recipientVars ? { recipientVars, recordVarKeys: prepared.recordVarKeys } : {}),
    },
  );
}

/** 記録の入口の最初の記録から埋める値(ほかの入口は null) */
async function firstRecordVars(prepared: Prepared): Promise<Record<string, unknown> | null> {
  const { item, entry } = prepared;
  if (!item || !("recordIds" in entry)) return null;
  const recipients = await recipientsOf(item, entry.recordIds);
  return recordVarsOf(firstRecipient(recipients, entry.recordIds), prepared.recordVarKeys);
}

/**
 * 自分へのテスト送信(宛先 = 操作した管理者だけ、is_test。記録の入口は選んだ最初の記録の値で組む。afterSend は呼ばない)
 * @throws DomainError(400) 操作した利用者が無い(システムの操作)・送る時と同じ検査
 */
export async function adminDefinitionTest(
  deps: AdminDefinitionSendDeps,
  rawInput: unknown,
): Promise<Omit<AdminDefinitionSendResult, "afterSend">> {
  await assertAdminActor(deps);
  const input = parseOr400(AdminDefinitionTestInputSchema, rawInput);
  const actorId = deps.context()?.actorId;
  if (!actorId) throw new DomainError("テスト送信の宛先(ログイン中の管理者)が見つかりません", { status: 400 });
  const prepared = await prepare(deps, input);
  const recipientVars = await firstRecordVars(prepared);
  const source = `${prepared.item ? `${prepared.item.key}.bulk` : BROADCAST_SOURCE}.test`;
  const result = await deps.sendResolved(
    prepared.resolved,
    {
      vars: prepared.vars,
      channels: prepared.channels,
      recipients: [{ userId: actorId }],
      ...(recipientVars ? { recipientVars: { [userRecipientKey(actorId)]: recipientVars } } : {}),
      isTest: true,
      idempotencyKey: input.idempotencyKey,
      source,
    },
    undefined,
    { recordVarKeys: recipientVars ? prepared.recordVarKeys : [], editedFields: prepared.editedFields },
  );
  await deps.recordAudit({
    targetType: "message_dispatch",
    targetId: result.dispatchId ?? "disabled",
    action: "messaging.dispatch.test_sent",
    metadata: { ...auditOf(prepared, "recordIds" in prepared.entry ? prepared.entry.recordIds.length : null), status: result.status },
  });
  return {
    dispatchId: result.dispatchId,
    status: result.status,
    counts: { recipientCount: 1, channelCounts: result.channelCounts, queuedCount: result.queuedCount },
  };
}

/** 定義 1 本の選択肢(レイアウトが受け口に無い定義は送れないので出さない) */
function definitionOption(deps: AdminDefinitionSendDeps, resolved: AnyResolvedMessageDefinition): AdminDefinitionOption | null {
  const layout = deps.layouts[resolved.layout];
  if (!layout) return null;
  const editableFields = adminEditableFields(resolved, layout);
  const values = (resolved.values ?? {}) as Record<string, unknown>;
  const names = (resolved.varNames ?? {}) as Readonly<Record<string, { alias?: string } | undefined>>;
  const split = definitionChannels(resolved);
  const defaults = new Set(deps.categories[resolved.category]?.defaultChannels ?? resolved.channels);
  return {
    key: resolved.key,
    label: resolved.label,
    layout: { key: layout.key, label: layout.label, version: layoutVersionOf(layout), fields: layout.fields },
    editableFields,
    values: Object.fromEntries(editableFields.flatMap((field) => (field in values ? [[field, values[field]]] : []))),
    adminVars: Object.entries((resolved.adminVars ?? {}) as Readonly<Record<string, MessageVarInput>>).map(([key, input]) => ({
      key,
      alias: names[key]?.alias ?? key,
      ...input,
    })),
    channels: Object.fromEntries(resolved.channels.map((channel) => [channel, channelModeOf(resolved, channel)])),
    initialChannels: resolved.channels.filter((channel) => split.on.includes(channel) || (split.free.includes(channel) && defaults.has(channel))),
    required: Boolean(resolved.required),
    adminTargets: [...(resolved.adminTargets ?? DEFAULT_DEFINITION_ADMIN_TARGETS)],
    adminText: resolved.adminText ? { ...resolved.adminText } : null,
  };
}

/** 送れる定義の選択肢(読める・止められていない・その入口の宛先を許す定義だけ、並びの順) */
async function definitionOptionsOf(
  deps: AdminDefinitionSendDeps,
  keys: readonly string[],
  accepts: (targets: readonly MessageDefinitionAdminTarget[]) => boolean,
): Promise<AdminDefinitionOption[]> {
  const options: AdminDefinitionOption[] = [];
  for (const key of keys) {
    const resolved = await deps.loadDefinition(key);
    if (!resolved || !resolved.enabled || !accepts(resolved.adminTargets ?? DEFAULT_DEFINITION_ADMIN_TARGETS)) continue;
    const option = definitionOption(deps, resolved);
    if (option) options.push(option);
  }
  return options;
}

/**
 * 定義連絡の選択肢(GET definitions/options)。記録の入口 = 項目(門番を通った物)と並んだ定義(門の外)/
 * 全員・ロール・グループの入口 = そのどれかを許す全部の定義(門 messagingBroadcast の中、閉なら 404)。ロール・グループの選び先は GET send/options
 * @throws DomainError(400) 条件 / (404) 項目が無い・門が閉
 */
export async function adminDefinitionOptions(deps: AdminDefinitionSendDeps, query: AdminDefinitionOptionsQuery = {}): Promise<AdminDefinitionOptions> {
  await assertAdminActor(deps);
  const parsed = parseOr400(AdminDefinitionOptionsQuerySchema, query ?? {});
  if (parsed.recordTarget !== undefined) {
    const item = await deps.recordTarget(parsed.recordTarget);
    if (!item) throw new DomainError("記録の宛先が見つかりません", { status: 404 });
    return {
      recordTarget: { key: item.key, label: item.label },
      definitions: await definitionOptionsOf(deps, item.messages, (targets) => targets.includes("records")),
    };
  }
  if (!deps.broadcastOpen()) throw new DomainError("見つかりません", { status: 404 });
  return {
    recordTarget: null,
    definitions: await definitionOptionsOf(deps, deps.messageKeys(), (targets) => targets.some((target) => target !== "records")),
  };
}
