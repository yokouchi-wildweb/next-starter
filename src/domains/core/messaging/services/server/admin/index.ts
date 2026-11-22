// src/domains/core/messaging/services/server/admin/index.ts
//
// 管理の送信と読む口(本物の部品を結ぶ)。呼び手は messagingService の admin* / listDispatches など。
// 管理 API: src/app/api/admin/messaging/**(./README.md「API」)

import { and, asc, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";

import { business } from "@/business";
import { gate } from "@/featureGate";
import { getAuditContext } from "@/lib/audit/server";
import { db } from "@/lib/drizzle";

import { auditLogger } from "@/domains/core/auditLog/services/server";
import { ALL_ROLES, getRoleCategory } from "@/domains/core/user/constants";
import { UserTable } from "@/domains/core/user/entities/drizzle";
import { UserGroupTable } from "@/domains/core/userGroup/entities/drizzle";
import { USER_GROUP_KIND_LABELS } from "@/domains/core/userGroup/services/server/admin/dto";

import { messagingConfig } from "../../../config";
import type { MessageDispatch } from "../../../entities/model";
import { MessageTemplateTable, MessageTemplateVersionTable } from "../../../entities/template";
import { messageRegistry } from "@/registry/messageRegistry";
import { recordTargetRegistry } from "@/registry/recordTargetRegistry";

import { categories } from "../../../extensions/categories";
import { channels } from "../../../extensions/channels";
import { enrichers } from "../../../extensions/enrichers";
import { layouts } from "../../../extensions/layouts";
import { sources } from "../../../extensions/sources";
import {
  checkSchedule,
  resolvedOfDispatch,
  estimateRecipients,
  previewMessage,
  sendFreeMessage,
  sendMessageDeps,
  scheduledContent,
  sendResolved,
} from "../sendMessage";
import { loadRecordTarget, messageDomainOpen } from "../domainGate";
import { resolveDefinition } from "../sendMessage/definition";
import { continueSending } from "../sweep";
import { buildContent } from "../sendMessage/content";
import { renderValue, toVariableMap } from "../sendMessage/context";
import { messageVarCatalog } from "../sendMessage/enrichers";
import { stopContextOf } from "../sendMessage/sender";
import { resolveUserAddresses } from "../sendMessage/expand";
import { checkStops, honoursPreferences } from "../sendMessage/stops";
import type { AdminCheckDeps } from "./assertAdmin";
import {
  adminBulkSend as adminBulkSendWith,
  adminBulkSendOptions as adminBulkSendOptionsWith,
  adminBulkSendPreview as adminBulkSendPreviewWith,
  adminBulkSendTest as adminBulkSendTestWith,
  type AdminBulkSendDeps,
  type AdminBulkSendInput,
} from "./bulkSend";
import { adminContinueSending as adminContinueSendingWith } from "./continueSending";
import {
  adminDefinitionPreview as adminDefinitionPreviewWith,
  adminDefinitionSend as adminDefinitionSendWith,
  adminDefinitionTest as adminDefinitionTestWith,
  adminDefinitionEstimate as adminDefinitionEstimateWith,
  adminDefinitionOptions as adminDefinitionOptionsWith,
  type AdminDefinitionOptionsQuery,
  type AdminDefinitionSendDeps,
} from "./definitionSend";
import { adminDispatchPreview as adminDispatchPreviewWith, type AdminDispatchPreviewDeps } from "./dispatchPreview";
import {
  adminBulkDeleteDispatches as adminBulkDeleteDispatchesWith,
  adminDeleteDispatch as adminDeleteDispatchWith,
  adminDispatchDeleteSummary as adminDispatchDeleteSummaryWith,
  adminResendFailed as adminResendFailedWith,
  policyOf,
  type AdminOperationsDeps,
} from "./operations";
import { drizzleMessageOperationsStore, drizzleScheduledEditStore } from "./operationsStore";
import {
  adminEditScheduledDispatch as adminEditScheduledDispatchWith,
  adminScheduledEditOptions as adminScheduledEditOptionsWith,
  type AdminScheduledEditDeps,
} from "./scheduledEdit";
import {
  adminSend as adminSendWith,
  adminSendEstimate as adminSendEstimateWith,
  adminSendOptions as adminSendOptionsWith,
  adminSendPreview as adminSendPreviewWith,
  adminSendTest as adminSendTestWith,
  type AdminSendDeps,
  type AdminSendGroupOption,
} from "./send";
import {
  dispatchCategoryOptions as dispatchCategoryOptionsWith,
  dispatchFilterOptions as dispatchFilterOptionsWith,
  findDispatch as findDispatchWith,
  listDeliveries as listDeliveriesWith,
  listDispatches as listDispatchesWith,
  type ListDeliveriesQuery,
  type ListDispatchesQuery,
} from "./readDispatches";
import { recipientChannels as recipientChannelsWith, type RecipientChannelsQuery } from "./recipientChannels";
import { sendResults as sendResultsWith, type SendResultsQuery } from "./sendResults";
import { sourceLabelOf } from "./sourceLabels";
import { dispatchReaders as dispatchReadersWith, type DispatchReadersQuery } from "./dispatchReaders";
import { drizzleAdminDispatchStore, drizzleDispatchReadersStore, drizzleSendResultsStore } from "./store";

const adminCheck: AdminCheckDeps = {
  context: () => getAuditContext(),
  async roleCategoryOf(userId) {
    const [row] = await db.select({ role: UserTable.role }).from(UserTable).where(eq(UserTable.id, userId)).limit(1);
    return row ? (getRoleCategory(row.role) ?? null) : null;
  },
};

const recordAudit = (input: Parameters<typeof auditLogger.record>[0]) => auditLogger.record(input);

/** 一括送信の部品(送る画面の部品を使う。門 messagingBroadcast には入れない、テンプレートの選択肢だけ門 messagingTemplates を見る) */
const bulkDeps = (): AdminBulkSendDeps => ({
  ...sendDeps,
  recordTarget,
  templatesOpen: () => gate.enabled("messagingTemplates"),
});

/** 管理の一括送信(中身は送る画面と同じ形、選んだ利用者へ) */
export function adminBulkSend(input: AdminBulkSendInput) {
  return adminBulkSendWith(bulkDeps(), input);
}

/** 一括送信のプレビュー(見本 = 操作した管理者) */
export function adminBulkSendPreview(input: unknown) {
  return adminBulkSendPreviewWith(bulkDeps(), input);
}

/** 一括送信の自分へのテスト送信 */
export function adminBulkSendTest(input: unknown) {
  return adminBulkSendTestWith(bulkDeps(), input);
}

/** 一括送信の選択肢(一覧の一括で送れるカテゴリーと、門 messagingTemplates が開の時だけ公開中のテンプレート) */
export function adminBulkSendOptions() {
  return adminBulkSendOptionsWith(bulkDeps());
}

/** 送信から描く定義(送信に残した物だけ。レイアウトが無い・版を読めない・誤りなら null) */
async function definitionOf(row: Parameters<typeof resolvedOfDispatch>[1]) {
  try {
    const loaded = await resolvedOfDispatch(sendMessageDeps, row);
    return "error" in loaded ? null : loaded.resolved;
  } catch {
    return null;
  }
}

/** 送信の操作(削除・削除の見込み・再送)の部品 */
const operationsDeps: AdminOperationsDeps<Parameters<Parameters<typeof drizzleMessageOperationsStore.withLockedDispatch>[1]>[0]> = {
  ...adminCheck,
  store: drizzleMessageOperationsStore,
  now: () => new Date(),
  channels: () => Object.values(channels),
  definitionOf,
  sendResolved,
  continueSending,
  recordAudit,
};

/** 送信の削除(D88、どの状態でも。削除済みは消せる送信チャンネルの remove だけを呼び直す) */
export const adminDeleteDispatch = (dispatchId: string) => adminDeleteDispatchWith(operationsDeps, dispatchId);
/** 送信のまとめての削除({ ids } 100 件まで) */
export const adminBulkDeleteDispatches = (input: unknown) => adminBulkDeleteDispatchesWith(operationsDeps, input);
/** 削除の見込み({ ids } 100 件まで、確認の画面) */
export const adminDispatchDeleteSummary = (input: unknown) => adminDispatchDeleteSummaryWith(operationsDeps, input);
/** 失敗の再送({ includeUnknown? }) */
export const adminResendFailed = (dispatchId: string, input?: unknown) => adminResendFailedWith(operationsDeps, dispatchId, input);

/** 送信の読む口の部品(1 件は操作ができるかも返す) */
/** 連絡の名前(定義の label、上書きの後)。鍵ごとに 1 度だけ読む */
const messageLabels = new Map<string, Promise<string | null>>();
function messageLabel(messageKey: string): Promise<string | null> {
  const entry = messageRegistry[messageKey];
  if (!entry) return Promise.resolve(null);
  let label = messageLabels.get(messageKey);
  if (!label) {
    label = (async () => {
      const [{ message }, override] = await Promise.all([entry.definition(), entry.override ? entry.override() : Promise.resolve(null)]);
      return override?.messageOverride?.label ?? message.label ?? null;
    })().catch(() => null);
    messageLabels.set(messageKey, label);
  }
  return label;
}

/** 送る画面のグループの選択肢の数(名前の順) */
const GROUP_OPTIONS_LIMIT = 200;

/** 使用中のユーザーグループ(例外の持ち主付きは出さない)。門 userGroups が閉なら空(D99) */
async function groupOptions(): Promise<AdminSendGroupOption[]> {
  if (!gate.enabled("userGroups")) return [];
  const rows = await db
    .select({ id: UserGroupTable.id, name: UserGroupTable.name, kind: UserGroupTable.kind })
    .from(UserGroupTable)
    .where(and(eq(UserGroupTable.status, "active"), isNull(UserGroupTable.owner_group_id)))
    .orderBy(asc(UserGroupTable.name), asc(UserGroupTable.id))
    .limit(GROUP_OPTIONS_LIMIT);
  return rows.map((row) => ({ id: row.id, label: row.name, kindLabel: USER_GROUP_KIND_LABELS[row.kind] ?? row.kind }));
}

/** 送信の宛先のグループの名前(しまったグループも)。門 userGroups が閉なら空(表が閉じていることがある) */
async function groupNames(groupIds: readonly string[]): Promise<Map<string, string>> {
  if (!gate.enabled("userGroups") || groupIds.length === 0) return new Map();
  const rows = await db
    .select({ id: UserGroupTable.id, name: UserGroupTable.name })
    .from(UserGroupTable)
    .where(inArray(UserGroupTable.id, [...groupIds]));
  return new Map(rows.map((row) => [row.id, row.name]));
}

/** 記録の宛先を鍵で読む(門番を通す唯一の口。生成の一覧 recordTargetRegistry は絞らない) */
const recordTarget = (key: string) => loadRecordTarget(recordTargetRegistry, key);
/** 記録の宛先の表示名(送り元の表示名が引く。閉じたドメインの物は null) */
const recordTargetLabel = async (key: string) => (await recordTarget(key))?.label ?? null;

const readDeps = {
  ...adminCheck,
  groupNames,
  dispatchStore: drizzleAdminDispatchStore,
  sourceLabel: (source: string) => sourceLabelOf({ sources, messageLabel, recordTargetLabel }, source),
  definitionLabel: messageLabel,
  async operationInputs(row: MessageDispatch) {
    const [resolved, counts] = await Promise.all([definitionOf(row), drizzleMessageOperationsStore.countFailed(null, row.id)]);
    return { policy: policyOf(resolved, row), counts };
  },
};

/** 管理の送信の部品 */
const sendDeps: AdminSendDeps = {
  ...adminCheck,
  sendFreeMessage,
  previewMessage,
  estimateRecipients,
  recordAudit,
  channels,
  categories,
  layouts,
  enrichers,
  roles: () => ALL_ROLES.map((role) => ({ id: role.id, label: role.label })),
  groupOptions,
  async listPublishedTemplates() {
    const rows = await db
      .select({
        id: MessageTemplateTable.id,
        key: MessageTemplateTable.key,
        name: MessageTemplateTable.name,
        currentVersion: MessageTemplateTable.current_version,
        category: MessageTemplateVersionTable.category,
        layout: MessageTemplateVersionTable.layout,
        layoutVersion: MessageTemplateVersionTable.layout_version,
        values: MessageTemplateVersionTable.values,
        vars: MessageTemplateVersionTable.vars,
      })
      .from(MessageTemplateTable)
      .innerJoin(
        MessageTemplateVersionTable,
        and(
          eq(MessageTemplateVersionTable.template_id, MessageTemplateTable.id),
          eq(MessageTemplateVersionTable.version, MessageTemplateTable.current_version),
        ),
      )
      .where(isNotNull(MessageTemplateTable.current_version))
      .orderBy(desc(MessageTemplateTable.updatedAt))
      .limit(200);
    return rows.map((row) => ({ ...row, currentVersion: row.currentVersion ?? 0 }));
  },
  maxScheduleDays: () => messagingConfig.schedule.maxDaysAhead,
  initialLayout: () => messagingConfig.initialLayout,
};

/** 管理の送信(テンプレートか自由連絡、今か予約) */
export const adminSend = (input: unknown) => adminSendWith(sendDeps, input);
/** 描いたプレビュー(見本 = 操作した管理者) */
export const adminSendPreview = (input: unknown) => adminSendPreviewWith(sendDeps, input);
/** 宛先数の見込み */
export const adminSendEstimate = (input: unknown) => adminSendEstimateWith(sendDeps, input);
/** 自分へのテスト送信 */
export const adminSendTest = (input: unknown) => adminSendTestWith(sendDeps, input);
/** 送る画面の選択肢 */
export const adminSendOptions = () => adminSendOptionsWith(sendDeps);

/** 定義連絡を管理者が送る部品(記録の入口は門 messagingBroadcast の外、全員・ロール・グループの入口は service が門を見る) */
const definitionDeps: AdminDefinitionSendDeps = {
  ...adminCheck,
  async loadDefinition(messageKey) {
    const entry = Object.hasOwn(messageRegistry, messageKey) ? messageRegistry[messageKey] : undefined;
    if (!entry || !messageDomainOpen(messageKey)) return null;
    const { message } = await entry.definition();
    return resolveDefinition(message, sendMessageDeps);
  },
  recordTarget,
  messageKeys: () => Object.keys(messageRegistry),
  categories,
  broadcastOpen: () => gate.enabled("messagingBroadcast"),
  estimateRecipients,
  layouts,
  enrichers,
  sendResolved,
  previewMessage,
  recordAudit,
};

/** 定義連絡を送る(POST /api/admin/messaging/definitions/send) */
export const adminDefinitionSend = (input: unknown) => adminDefinitionSendWith(definitionDeps, input);
/** 定義連絡のプレビュー(見本 = 操作した管理者、記録の入口は最初の記録の値) */
export const adminDefinitionPreview = (input: unknown) => adminDefinitionPreviewWith(definitionDeps, input);
/** 定義連絡の自分へのテスト送信 */
export const adminDefinitionTest = (input: unknown) => adminDefinitionTestWith(definitionDeps, input);
/** 定義連絡の全員・ロール・グループの人数の見込み(POST /api/admin/messaging/definitions/estimate。門 messagingBroadcast は service が見る) */
export const adminDefinitionEstimate = (input: unknown) => adminDefinitionEstimateWith(definitionDeps, input);
/** 定義連絡の選択肢(GET /api/admin/messaging/definitions/options。?recordTarget= は門の外、?entry=broadcast は門 messagingBroadcast の中) */
export const adminDefinitionOptions = (query?: AdminDefinitionOptionsQuery) => adminDefinitionOptionsWith(definitionDeps, query);

/** 送信の一覧 */
export function listDispatches(query?: ListDispatchesQuery) {
  return listDispatchesWith(readDeps, query);
}

/** 送信の一覧の絞りの選択肢(送り元・運営として送った人) */
export function dispatchFilterOptions() {
  return dispatchFilterOptionsWith(readDeps);
}

/** 送信 1 件 */
export function findDispatch(id: string) {
  return findDispatchWith(readDeps, id);
}

/** 予約の直しの部品(送る口と同じ検査と中身の組み立て、定義連絡は定義の読み口を共にする) */
const scheduledEditDeps: AdminScheduledEditDeps = {
  ...adminCheck,
  store: drizzleScheduledEditStore,
  now: () => new Date(),
  layouts,
  categories,
  channels,
  enrichers,
  loadDefinition: definitionDeps.loadDefinition,
  async loadTemplateVersion(templateId, version) {
    return sendMessageDeps.templates ? sendMessageDeps.templates.loadVersion(templateId, version) : null;
  },
  resolveDispatch: (row) => resolvedOfDispatch(sendMessageDeps, row),
  checkSchedule,
  maxScheduleDays: messagingConfig.schedule.maxDaysAhead,
  scheduledContent,
  findDetail: (id) => findDispatchWith(readDeps, id),
  recordAudit,
};

/** 予約した送信を送る前に直す(PATCH /api/admin/messaging/dispatches/[id]。文面の欄・送信チャンネル・時刻、宛先は変えない) */
export const adminEditScheduledDispatch = (dispatchId: string, input: unknown) =>
  adminEditScheduledDispatchWith(scheduledEditDeps, dispatchId, input);

/** 予約した送信の直しの材料(GET dispatches/[id]/edit-options。直しと同じ決まりで直せる欄・送信チャンネルの固定・今の欄の中身) */
export const adminScheduledEditOptions = (dispatchId: string) => adminScheduledEditOptionsWith(scheduledEditDeps, dispatchId);

/** 送信のプレビューの部品(送信だけから描く。送る口と同じ組み立て) */
const previewDeps: AdminDispatchPreviewDeps = {
  ...adminCheck,
  findDispatch: (id) => drizzleAdminDispatchStore.findDispatch(id),
  resolve: (row) => resolvedOfDispatch(sendMessageDeps, row),
  layouts: sendMessageDeps.layouts,
  buildContent: (resolved, channel, map) => buildContent(sendMessageDeps, resolved, channel, map),
  renderValue,
  toVariableMap: (values) => toVariableMap(values),
  varCatalog: (resolved) => messageVarCatalog(resolved, sendMessageDeps.enrichers ?? {}),
  commonValues: () => sendMessageDeps.context(),
  honoursPreferences: (resolved) => honoursPreferences(stopContextOf(resolved)),
  channelLabel: (channel) => channels[channel]?.label ?? null,
  channelPreview(channel, input) {
    const item = channels[channel];
    return item?.preview ? item.preview({ ...input, messageKey: input.messageKey as never }) : null;
  },
};

/** 送信のプレビュー(GET /api/admin/messaging/dispatches/[id]/preview) */
export function adminDispatchPreview(id: string) {
  return adminDispatchPreviewWith(previewDeps, id);
}

/** 送信の画面の絞りの選択肢(カテゴリーの鍵・表示名・種別) */
export function dispatchCategoryOptions() {
  return dispatchCategoryOptionsWith({ ...adminCheck, categories });
}

/** 送信の配達 */
export function listDeliveries(dispatchId: string, query?: ListDeliveriesQuery) {
  return listDeliveriesWith(readDeps, dispatchId, query);
}

/** 既読した利用者の一覧(時刻のある既読だけ、既読の新しい順。GET /api/admin/messaging/dispatches/[id]/readers) */
export function dispatchReaders(dispatchId: string, query?: DispatchReadersQuery) {
  return dispatchReadersWith({ ...adminCheck, readersStore: drizzleDispatchReadersStore }, dispatchId, query);
}

/** 送信の結果(送信チャンネルごとの数 + 届かなかった人と理由のページ送り。門の外、管理者だけ) */
export function sendResults(dispatchId: string, query?: SendResultsQuery) {
  return sendResultsWith({ ...adminCheck, sendResultsStore: drizzleSendResultsStore }, dispatchId, query);
}

/** 1 人の利用者の受け取れる送信チャンネル(送る口と同じ宛先の引き方と停止の判定。門の外、管理者だけ) */
export function recipientChannels(userId: string, query?: RecipientChannelsQuery) {
  return recipientChannelsWith(
    {
      ...adminCheck,
      userExists: async (id) => (await sendMessageDeps.store.findUsers([id])).length > 0,
      categories,
      channels,
      loadDefinition: definitionDeps.loadDefinition,
      resolveAddresses: (key, channel, userIds) => resolveUserAddresses(sendMessageDeps, key, channel, userIds),
      checkStops: (context, targets) => checkStops(sendMessageDeps, context, targets),
    },
    userId,
    query,
  );
}

/** 管理の「続きを送る」 */
export function adminContinueSending(dispatchId: string) {
  return adminContinueSendingWith({ ...adminCheck, continueSending, recordAudit }, dispatchId);
}

export { AdminBulkSendInputSchema, ADMIN_BULK_SEND_MAX_RECIPIENTS } from "./bulkSend";
export { ListDeliveriesQuerySchema, ListDispatchesQuerySchema } from "./readDispatches";
export type { AdminBulkSendInput, AdminBulkSendOptions, AdminBulkSendResult } from "./bulkSend";
export { AdminDefinitionEstimateInputSchema, AdminDefinitionOptionsQuerySchema, AdminDefinitionSendInputSchema } from "./definitionSend";
export type {
  AdminDefinitionEntry,
  AdminDefinitionOption,
  AdminDefinitionOptions,
  AdminDefinitionEstimateInput,
  AdminDefinitionOptionsQuery,
  AdminDefinitionPreviewInput,
  AdminDefinitionSendInput,
  AdminDefinitionSendResult,
  AdminDefinitionTestInput,
} from "./definitionSend";
export { ADMIN_SEND_MAX_USERS } from "./send";
export type { AdminFreeTextCategoryOption } from "./freeText";
export { ADMIN_DELETE_MAX_IDS, AdminDispatchIdsInputSchema, AdminResendInputSchema } from "./operations";
export { AdminScheduledEditInputSchema } from "./scheduledEdit";
export type { AdminScheduledEditInput, AdminScheduledEditOptions } from "./scheduledEdit";
export type {
  AdminBulkDeleteResult,
  AdminDeleteResult,
  AdminDeleteSummary,
  AdminResendResult,
  DispatchOperationFlag,
  DispatchOperationFlags,
  DispatchOperationReason,
} from "./operations";
export type {
  AdminSendEstimateInput,
  AdminSendGroupOption,
  AdminSendInput,
  AdminSendOptions,
  AdminSendPreviewInput,
  AdminSendResult,
  AdminSendTestInput,
} from "./send";
export type { AdminDispatchCategoryOption, AdminDispatchFilterOptions, AdminPage, ListDeliveriesQuery, ListDispatchesQuery } from "./readDispatches";
export { RecipientChannelsQuerySchema } from "./recipientChannels";
export type { AdminRecipientChannels, RecipientChannelReason, RecipientChannelState, RecipientChannelsQuery } from "./recipientChannels";
export { SendResultsQuerySchema } from "./sendResults";
export { DispatchReadersQuerySchema } from "./dispatchReaders";
export type { DispatchReader, DispatchReadersQuery } from "./dispatchReaders";
export type { AdminSendResultFailure, AdminSendResults, SendResultsQuery, UndeliveredStatus } from "./sendResults";
export type { AdminDeliveryRow, AdminDispatchDetail, AdminDispatchSameAs, AdminDispatchSummary, AdminDispatchTarget, AdminDispatchTargetGroup } from "./dispatchDto";
export type { AdminBulkSendCounts, AdminMessageContent } from "./types";
