// src/domains/core/messaging/services/server/admin/scheduledEdit.ts
//
// 予約した送信の送る前の直し(D210、指令 13 の AMENDMENT 1。PATCH /api/admin/messaging/dispatches/[id]、門 messagingDispatches)。
// - 直せるのは文面の欄(edits)・送信チャンネル(channels)・予約の時刻(scheduledAt)だけ。宛先(target)・人数・vars・冪等の鍵・送った人は変えない
//   (宛先は送り始めで固まる D98・D101。宛先を変えたいなら消して作り直す)
// - 直せるのは予約のまま(status scheduled)で削除していない送信だけ(できるかの印は operations.ts の scheduledEditFlag。画面の canEdit と同じ判定)。
//   本文を残していない送信(body_missing)・テンプレートを消した自由連絡(template_missing)は時刻だけ(文面・送信チャンネルは 409)
// - 書き込みは条件つきの UPDATE 1 回(where status = 'scheduled' and deleted_at is null)。cron の拾い(activateScheduled)が先なら 0 行 → 409
//   (読んでから書くまでに cron が processing にした送信は直さない)
// - 検査は送る時と同じ:
//   - 時刻: 過ぎた・maxDaysAhead より先は 400(送る口の checkSchedule)
//   - 定義連絡の送信(message_key あり): 連絡定義(コード + 上書き)の直せる欄だけ(adminEditableFields。外・値の形・使えない差し込みは 400)、
//     required の連絡は直せない(400)。送信チャンネルは定義の固定(on / off)とカテゴリーの中の絞り(resolveChannels)。
//     編集した欄の印 edited_fields は前の印 ∪ 今回直した欄
//   - 自由連絡(message_key null): 送る口と同じ組み方(resolveTemplateDefinition: カテゴリーの種別・絞り・欄の中身・差し込み)。
//     DB のテンプレートの送信は固定した版の宣言で検査し、直した印 template_edited を版の中身とくらべて付け直す
//   - 欄の中身は送信の送信チャンネルで使う欄だけ必須(layoutValuesSchema の channels)
// - edits = 変えた欄だけ(今の版の欄の鍵 → 値)。送信に残した欄の中身(今のレイアウトの版へ読み替えた物)に重ねる。null・空は任意の欄を消す(必須の欄は 400)
// - channels = 直した後の送信チャンネルの一覧(送る時の本文と同じ形。差分ではない)
// - 直した後は送る時と同じ中身の列を組み直す(件名・題 headings・全員同文の描画 rendered・欄の中身・レイアウトの版・送信チャンネルごとの数の空の形)
// - 監査 messaging.dispatch.edited(直した欄の鍵・送信チャンネルと時刻の前後)。返す形は送信 1 件の DTO(AdminDispatchDetail)
// 直しの材料(GET …/edit-options、adminScheduledEditOptions): 直せる欄・送信チャンネルの固定・今の欄の中身を、直しと同じ関数
// (definitionEditContext / freeEditSource)から返す(画面が出す欄と PATCH が受ける欄が 1 つの決まり)

import { z } from "zod";

import type { AuditRecordInput } from "@/lib/audit";
import { DomainError } from "@/lib/errors";
import {
  adminEditableFields,
  applyAdminFieldValues,
  channelModeOf,
  isLayoutAdminSelectable,
  isLayoutUsable,
  layoutValuesSchema,
  layoutVersionOf,
  type MessageCategory,
  type MessageChannel,
  type MessageEnricher,
  type MessageChannelMode,
  type MessageLayout,
} from "@/lib/messaging";

import type { MessageDispatch, MessageDispatchInsert } from "../../../entities/model";
import { resolveChannels, type AnyResolvedMessageDefinition } from "../sendMessage/definition";
import type { DispatchResolveError } from "../sendMessage/dispatchResolved";
import { enricherKeysFor } from "../sendMessage/enrichers";
import { resolveTemplateDefinition, templateValuesEdited, type FreeSource } from "../sendMessage/templateDefinition";
import type { MessageTemplateVersionSource } from "../sendMessage/types";
import { assertAdminActor, type AdminCheckDeps } from "./assertAdmin";
import type { AdminDispatchDetail } from "./dispatchDto";
import { scheduledEditFlag, type DispatchOperationReason } from "./operations";
import { DISPATCH_OPERATION_REASON_TEXT } from "../../../constants/dispatchOperations";

export const AdminScheduledEditInputSchema = z
  .object({
    /** 変えた欄だけ(今の版の欄の鍵 → 値)。null・空は任意の欄を消す */
    edits: z.record(z.string().min(1).max(100), z.unknown()).optional(),
    /** 直した後の送信チャンネルの一覧(送る時の本文と同じ形) */
    channels: z.array(z.string().min(1)).min(1).max(20).optional(),
    /** 予約の時刻(ISO 8601) */
    scheduledAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict()
  .refine((input) => input.edits !== undefined || input.channels !== undefined || input.scheduledAt !== undefined, {
    message: "直す物(edits・channels・scheduledAt)を 1 つ以上指定してください",
  });
export type AdminScheduledEditInput = z.input<typeof AdminScheduledEditInputSchema>;

/** 直しで書く列(宛先・人数・vars・冪等の鍵・送った人は入らない) */
export type ScheduledEditPatch = Pick<
  Partial<MessageDispatchInsert>,
  | "scheduled_at"
  | "channels"
  | "headings"
  | "rendered"
  | "values"
  | "layout_version"
  | "channel_counts"
  | "edited_fields"
  | "template_edited"
  | "updatedAt"
>;

/** 予約の直しの DB(テストは偽物を渡す) */
export type ScheduledEditStore = {
  findDispatch: (id: string) => Promise<MessageDispatch | null>;
  /** 条件つきの更新 1 回: id かつ status = 'scheduled' かつ deleted_at is null の時だけ書く。書いたか(0 行 = false) */
  updateScheduled: (id: string, patch: ScheduledEditPatch) => Promise<boolean>;
};

/** 送る口が送信へ書く中身の列(sendMessage/sender.ts の scheduledContent) */
export type ScheduledContent = Required<
  Pick<ScheduledEditPatch, "channels" | "headings" | "rendered" | "values" | "layout_version" | "channel_counts">
>;

export type AdminScheduledEditDeps = AdminCheckDeps & {
  store: ScheduledEditStore;
  now: () => Date;
  layouts: Readonly<Record<string, MessageLayout>>;
  categories: Readonly<Record<string, MessageCategory>>;
  channels: Readonly<Record<string, MessageChannel>>;
  enrichers: Readonly<Record<string, MessageEnricher>>;
  /** 連絡定義を送れる形にして読む(上書き・テキストの編集の後)。無い鍵・連絡のドメインが閉じている = null */
  loadDefinition: (messageKey: string) => Promise<AnyResolvedMessageDefinition | null>;
  /** DB のテンプレートの固定した版(無ければ null) */
  loadTemplateVersion: (templateId: string, version: number) => Promise<MessageTemplateVersionSource | null>;
  /** 送信から描く定義(欄の中身を今のレイアウトの版へ読み替える。dispatchResolved.ts) */
  resolveDispatch: (row: MessageDispatch) => Promise<{ resolved: AnyResolvedMessageDefinition } | { error: DispatchResolveError }>;
  /** 予約の時刻の検査(送る口と同じ)。@throws DomainError(400) */
  checkSchedule: (scheduledAt: Date) => void;
  /** 予約できる日数の上限(config の schedule.maxDaysAhead。直しの材料が返す) */
  maxScheduleDays: number;
  /** 送る時と同じ中身の列を組む */
  scheduledContent: (
    resolved: AnyResolvedMessageDefinition,
    channels: readonly string[],
    vars: Record<string, unknown>,
  ) => Promise<ScheduledContent>;
  /** 直した後の送信 1 件の DTO */
  findDetail: (id: string) => Promise<AdminDispatchDetail>;
  recordAudit: (input: AuditRecordInput) => Promise<unknown>;
};

function refuse(reason: DispatchOperationReason): never {
  throw new DomainError(DISPATCH_OPERATION_REASON_TEXT[reason], { status: reason === "not_found" ? 404 : 409, code: reason });
}

const isEmpty = (value: unknown) => value === null || value === "";

/** 送信に残した欄の中身に変えた欄を重ねる(null・空は消す。空を「無い」にするのは検査の前の整え) */
function mergeValues(current: Record<string, unknown>, edits: Record<string, unknown>): Record<string, unknown> {
  const merged = { ...current };
  for (const [key, value] of Object.entries(edits)) {
    if (value === null) delete merged[key];
    else merged[key] = value;
  }
  return merged;
}

/** 欄の中身を送信の送信チャンネルで使う欄だけ必須として検査する(送る口と同じ決まり) */
function checkLayoutValues(layout: MessageLayout, values: Record<string, unknown>, channels: readonly string[]): void {
  const parsed = layoutValuesSchema(layout, { channels }).safeParse(values);
  if (parsed.success) return;
  const detail = parsed.error.issues.map((issue) => `${issue.path.join(".") || "(全体)"}: ${issue.message}`).join(" / ");
  throw new DomainError(`レイアウト「${layout.label}」の欄の中身が正しくありません(${detail})`, { status: 400 });
}

type Rebuilt = { resolved: AnyResolvedMessageDefinition; channels: string[]; extra: Pick<ScheduledEditPatch, "edited_fields" | "template_edited"> };

type DefinitionEditContext = {
  code: AnyResolvedMessageDefinition;
  layout: MessageLayout;
  /** 送信に残した物の上にコードの定義の振る舞いを重ねた定義 */
  base: AnyResolvedMessageDefinition;
  /** 直せる欄(required の連絡は無い) */
  editableFields: string[];
};

/**
 * 定義連絡の送信の直しの決まり(直しと直しの材料が共に使う): 送信に残した物(カテゴリー・種別・記録の段・欄の中身)の上に、
 * コードの定義の振る舞い(直せる欄・送信チャンネルの固定・vars)を使う。連絡定義が無い = 409 definition_missing、レイアウトが変わった = 409
 */
async function definitionEditContext(
  deps: AdminScheduledEditDeps,
  row: MessageDispatch,
  current: Record<string, unknown>,
): Promise<DefinitionEditContext> {
  const code = await deps.loadDefinition(row.message_key!);
  if (!code) refuse("definition_missing");
  const layout = deps.layouts[code.layout];
  if (!layout || code.layout !== row.layout) {
    throw new DomainError("連絡定義のレイアウトが予約の後に変わったので直せません。削除して送り直してください", { status: 409 });
  }
  const base = {
    ...code,
    category: row.category ?? code.category,
    kind: row.kind ?? code.kind,
    ...(row.record ? { record: row.record } : {}),
    values: current,
  } as AnyResolvedMessageDefinition;
  return { code, layout, base, editableFields: code.required ? [] : adminEditableFields(base, layout) };
}

/** 定義連絡の送信の直し: 連絡定義の直せる欄だけ・定義の送信チャンネルの固定 */
async function rebuildDefinitionSend(
  deps: AdminScheduledEditDeps,
  row: MessageDispatch,
  current: Record<string, unknown>,
  edits: Record<string, unknown>,
  requested: readonly string[],
): Promise<Rebuilt> {
  const { code, layout, base, editableFields: editable } = await definitionEditContext(deps, row, current);
  const entries = Object.entries(edits).filter(([key, value]) => JSON.stringify(current[key]) !== JSON.stringify(value));
  let resolved = base;
  let applied: string[] = [];
  if (entries.length > 0) {
    if (code.required) throw new DomainError(`止められない連絡のテキストは編集できません(${code.key})`, { status: 400 });
    const outside = entries.filter(([key]) => !editable.includes(key)).map(([key]) => key);
    if (outside.length > 0) throw new DomainError(`連絡 ${code.label} の直せない欄です: ${outside.join(", ")}`, { status: 400 });
    // 任意の欄を消す(null・空): 必須の欄は消せない
    const cleared = entries.filter(([, value]) => isEmpty(value)).map(([key]) => key);
    const required = cleared.filter((key) => layout.fields[key]?.required);
    if (required.length > 0) throw new DomainError(`必須の欄は消せません: ${required.join(", ")}`, { status: 400 });
    const version = layoutVersionOf(layout);
    const merged = applyAdminFieldValues(
      { ...base, values: mergeValues(current, Object.fromEntries(cleared.map((key) => [key, null]))) } as AnyResolvedMessageDefinition,
      layout,
      entries.filter(([, value]) => !isEmpty(value)).map(([fieldPath, value]) => ({ fieldPath, value, layoutVersion: version })),
      { variableKeys: enricherKeysFor(base, deps.enrichers) },
    );
    const [rejected] = merged.rejected;
    if (rejected) throw new DomainError(rejected.problem.message, { status: 400 });
    resolved = merged.resolved;
    applied = [...merged.applied, ...cleared];
  }
  const channels = resolveChannels(resolved, requested);
  checkLayoutValues(layout, (resolved.values ?? {}) as Record<string, unknown>, channels);
  const editedFields = [...new Set([...(row.edited_fields ?? []), ...applied])];
  return { resolved, channels, extra: { edited_fields: editedFields.length > 0 ? editedFields : null } };
}

/**
 * 自由連絡の送信の直しの出どころ(直しと直しの材料が共に使う): DB のテンプレートの固定した版か、レイアウトを直に選んだ物。
 * 直せる欄 = そのレイアウトの欄の全部。版が無い・テンプレートを消した = 409 template_missing、使えない・選べないレイアウト = 400
 */
async function freeEditSource(deps: AdminScheduledEditDeps, row: MessageDispatch): Promise<{ source: FreeSource; layout: MessageLayout }> {
  if (row.template_id && row.template_version) {
    const version = await deps.loadTemplateVersion(row.template_id, row.template_version);
    if (!version) refuse("template_missing");
    const layout = deps.layouts[version.layout];
    if (!layout || !isLayoutUsable(layout)) {
      throw new DomainError(`レイアウト ${version.layout} は使えません(無効)。テンプレート ${version.templateKey} の送信は直せません`, { status: 400 });
    }
    return { source: { version }, layout };
  }
  if (row.template_version) {
    // テンプレートを消した送信(D137): 版の埋め込み情報の宣言が無いので差し込みを検査できない(印 canEdit.content と同じ)
    refuse("template_missing");
  }
  const layout = row.layout ? deps.layouts[row.layout] : undefined;
  if (!layout || !isLayoutAdminSelectable(layout)) {
    throw new DomainError(`レイアウト ${row.layout ?? "(なし)"} は自由連絡で選べません(管理画面で選べるレイアウトだけ)`, { status: 400 });
  }
  return { source: { layout }, layout };
}

/** 自由連絡の送信の直し: 送る口と同じ組み方(レイアウトを直に選んだ物か DB のテンプレートの固定した版) */
async function rebuildFreeSend(
  deps: AdminScheduledEditDeps,
  row: MessageDispatch,
  current: Record<string, unknown>,
  edits: Record<string, unknown>,
  requested: readonly string[],
): Promise<Rebuilt> {
  const { source } = await freeEditSource(deps, row);
  const values = mergeValues(current, edits);
  const built = resolveTemplateDefinition(deps, { category: row.category ?? "", values, channels: requested, source });
  const resolved = { ...built, kind: row.kind ?? built.kind, ...(row.record ? { record: row.record } : {}) } as AnyResolvedMessageDefinition;
  const channels = resolveChannels(resolved, requested);
  return {
    resolved,
    channels,
    extra:
      "version" in source
        ? { template_edited: row.template_edited || templateValuesEdited(deps.layouts, source.version, (built.values ?? {}) as Record<string, unknown>) }
        : {},
  };
}

/**
 * 予約した送信を送る前に直す。
 * @throws DomainError(400) 入力・送る時の検査 / (404) 送信が無い / (409) 予約のままでない・削除した・時刻だけの送信の文面・cron が先に拾った / (403) 管理者でない
 */
export async function adminEditScheduledDispatch(
  deps: AdminScheduledEditDeps,
  dispatchId: string,
  rawInput: unknown,
): Promise<AdminDispatchDetail> {
  await assertAdminActor(deps);
  const parsed = AdminScheduledEditInputSchema.safeParse(rawInput ?? {});
  if (!parsed.success) throw new DomainError(parsed.error.issues[0]?.message ?? "直す物の指定が正しくありません", { status: 400 });
  const input = parsed.data;

  const row = await deps.store.findDispatch(dispatchId);
  if (!row) refuse("not_found");
  const flag = scheduledEditFlag(row);
  if (!flag.allowed) refuse(flag.reason!);
  const contentEdit = input.edits !== undefined || input.channels !== undefined;
  if (contentEdit && !flag.content.allowed) refuse(flag.content.reason!);

  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : undefined;
  if (scheduledAt) deps.checkSchedule(scheduledAt);

  const now = deps.now();
  let patch: ScheduledEditPatch = { updatedAt: now, ...(scheduledAt ? { scheduled_at: scheduledAt } : {}) };
  if (contentEdit) {
    const loaded = await deps.resolveDispatch(row);
    if ("error" in loaded) refuse("definition_missing");
    const current = (loaded.resolved.values ?? {}) as Record<string, unknown>;
    const edits = input.edits ?? {};
    const requested = input.channels ?? row.channels;
    const rebuilt = row.message_key
      ? await rebuildDefinitionSend(deps, row, current, edits, requested)
      : await rebuildFreeSend(deps, row, current, edits, requested);
    const content = await deps.scheduledContent(rebuilt.resolved, rebuilt.channels, (row.vars ?? {}) as Record<string, unknown>);
    patch = { ...patch, ...content, ...rebuilt.extra };
  }

  if (!(await deps.store.updateScheduled(dispatchId, patch))) {
    // 読んでから書くまでに cron が拾った(processing)か、削除された
    const again = await deps.store.findDispatch(dispatchId);
    refuse(!again ? "not_found" : again.deleted_at ? "deleted" : "not_scheduled");
  }

  const channelsChanged = patch.channels !== undefined && JSON.stringify(patch.channels) !== JSON.stringify(row.channels);
  await deps.recordAudit({
    targetType: "message_dispatch",
    targetId: dispatchId,
    action: "messaging.dispatch.edited",
    metadata: {
      fields: Object.keys(input.edits ?? {}),
      ...(channelsChanged ? { channels: { before: row.channels, after: patch.channels } } : {}),
      ...(scheduledAt ? { scheduledAt: { before: row.scheduled_at?.toISOString() ?? null, after: scheduledAt.toISOString() } } : {}),
    },
  });
  return deps.findDetail(dispatchId);
}

/** 直しの材料(GET /api/admin/messaging/dispatches/[id]/edit-options) */
export type AdminScheduledEditOptions = {
  /** 今の版のレイアウト(文面を直せない送信 = null) */
  layout: { key: string; label: string; version: number; fields: MessageLayout["fields"] } | null;
  /** 直せる欄の鍵(自由連絡 = レイアウトの欄の全部 / 定義連絡 = 連絡定義の直せる欄、required の連絡は無い) */
  editableFields: string[];
  /** 送信に残した欄の中身(今のレイアウトの版へ読み替えた物。文面を直せない送信 = null) */
  values: Record<string, unknown> | null;
  /** 送信チャンネルごとの固定(自由連絡 = カテゴリーの送信チャンネルが全部 free / 定義連絡 = 定義の固定。文面を直せない送信 = 空) */
  channels: Record<string, MessageChannelMode>;
  /** 予約できる日数の上限 */
  maxScheduleDays: number;
};

/**
 * 予約した送信の直しの材料。直しと同じ判定(scheduledEditFlag)と同じ関数(definitionEditContext / freeEditSource)から組む。
 * 時刻だけ直せる送信(本文を残していない・テンプレートを消した = canEdit.content が不可)は文面の材料を空で返す(画面は時刻だけ直す)
 * @throws DomainError(404) 送信が無い / (409) 予約のままでない・削除した・連絡定義が無い / (403) 管理者でない
 */
export async function adminScheduledEditOptions(deps: AdminScheduledEditDeps, dispatchId: string): Promise<AdminScheduledEditOptions> {
  await assertAdminActor(deps);
  const row = await deps.store.findDispatch(dispatchId);
  if (!row) refuse("not_found");
  const flag = scheduledEditFlag(row);
  if (!flag.allowed) refuse(flag.reason!);
  const timeOnly: AdminScheduledEditOptions = { layout: null, editableFields: [], values: null, channels: {}, maxScheduleDays: deps.maxScheduleDays };
  if (!flag.content.allowed) return timeOnly;

  const loaded = await deps.resolveDispatch(row);
  if ("error" in loaded) refuse("definition_missing");
  const values = (loaded.resolved.values ?? {}) as Record<string, unknown>;
  const layoutOf = (layout: MessageLayout) => ({ key: layout.key, label: layout.label, version: layoutVersionOf(layout), fields: layout.fields });
  if (row.message_key) {
    const { layout, base, editableFields } = await definitionEditContext(deps, row, values);
    const categoryChannels = deps.categories[base.category]?.channels ?? base.channels;
    return {
      layout: layoutOf(layout),
      editableFields,
      values,
      channels: Object.fromEntries(categoryChannels.map((channel) => [channel, channelModeOf(base, channel)])),
      maxScheduleDays: deps.maxScheduleDays,
    };
  }
  const { layout } = await freeEditSource(deps, row);
  const categoryChannels = deps.categories[row.category ?? ""]?.channels ?? [];
  return {
    layout: layoutOf(layout),
    editableFields: Object.keys(layout.fields),
    values,
    channels: Object.fromEntries(categoryChannels.map((channel) => [channel, "free" as const])),
    maxScheduleDays: deps.maxScheduleDays,
  };
}
