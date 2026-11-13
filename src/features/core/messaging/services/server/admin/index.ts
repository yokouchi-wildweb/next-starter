// src/features/core/messaging/services/server/admin/index.ts
//
// 管理の送信と読む口(本物の部品を結ぶ)。呼び手は messagingService の admin* / listDispatches など。
// 管理 API: src/app/api/admin/messaging/**(README「管理の送信と回の読む口」)

import { and, desc, eq, isNotNull } from "drizzle-orm";

import { business } from "@/business";
import { getAuditContext } from "@/lib/audit";
import { db } from "@/lib/drizzle";

import { auditLogger } from "@/features/core/auditLog/services/server";
import { ALL_ROLES, getRoleCategory } from "@/features/core/user/constants";
import { UserTable } from "@/features/core/user/entities/drizzle";

import { messagingConfig } from "../../../config";
import type { MessageDispatch } from "../../../entities/model";
import { MessageTemplateTable, MessageTemplateVersionTable } from "../../../entities/template";
import { audiences } from "../../../extensions/audiences";
import { bulkSendTargets } from "../../../extensions/bulkSendTargets";
import { categories } from "../../../extensions/categories";
import { channels } from "../../../extensions/channels";
import {
  definitionOfDispatch,
  estimateRecipients,
  previewMessage,
  sendMessageDeps,
  sendMessageToMany,
  sendResolved,
  sendTemplate,
} from "../sendMessage";
import { continueSending } from "../sweep";
import type { AdminCheckDeps } from "./assertAdmin";
import { adminBulkSend as adminBulkSendWith, adminBulkSendOptions as adminBulkSendOptionsWith, type AdminBulkSendInput } from "./bulkSend";
import { adminContinueSending as adminContinueSendingWith } from "./continueSending";
import {
  adminCancelScheduled as adminCancelScheduledWith,
  adminResendFailed as adminResendFailedWith,
  adminRetract as adminRetractWith,
  policyOf,
  type AdminOperationsDeps,
} from "./operations";
import { drizzleMessageOperationsStore } from "./operationsStore";
import {
  adminSend as adminSendWith,
  adminSendEstimate as adminSendEstimateWith,
  adminSendOptions as adminSendOptionsWith,
  adminSendPreview as adminSendPreviewWith,
  adminSendTest as adminSendTestWith,
  type AdminSendDeps,
} from "./send";
import {
  findDispatch as findDispatchWith,
  listDeliveries as listDeliveriesWith,
  listDispatches as listDispatchesWith,
  type ListDeliveriesQuery,
  type ListDispatchesQuery,
} from "./readDispatches";
import { drizzleAdminDispatchStore } from "./store";

const adminCheck: AdminCheckDeps = {
  context: () => getAuditContext(),
  async roleCategoryOf(userId) {
    const [row] = await db.select({ role: UserTable.role }).from(UserTable).where(eq(UserTable.id, userId)).limit(1);
    return row ? (getRoleCategory(row.role) ?? null) : null;
  },
};

const recordAudit = (input: Parameters<typeof auditLogger.record>[0]) => auditLogger.record(input);

/** 管理の一括送信(選んだカテゴリーの種別の定義 messages/admin<Kind>.ts) */
export function adminBulkSend(input: AdminBulkSendInput) {
  return adminBulkSendWith(
    {
      ...adminCheck,
      targets: bulkSendTargets,
      categories,
      sendMessageToMany,
      recordAudit,
      serviceNameShort: () => business.serviceNameShort,
    },
    input,
  );
}

/** 一括送信の選択肢(一覧の一括で送れるカテゴリー) */
export function adminBulkSendOptions() {
  return adminBulkSendOptionsWith({ ...adminCheck, categories });
}

/** 回の定義(読めない・誤りなら null。テンプレートの回は固定した版) */
async function definitionOf(row: Parameters<typeof definitionOfDispatch>[1]) {
  try {
    const loaded = await definitionOfDispatch(sendMessageDeps, row);
    return "error" in loaded ? null : loaded.resolved;
  } catch {
    return null;
  }
}

/** 回の操作(取り消し・取り下げ・再送)の部品 */
const operationsDeps: AdminOperationsDeps<Parameters<Parameters<typeof drizzleMessageOperationsStore.withLockedDispatch>[1]>[0]> = {
  ...adminCheck,
  store: drizzleMessageOperationsStore,
  now: () => new Date(),
  definitionOf,
  sendResolved,
  continueSending,
  recordAudit,
};

/** 予約の取り消し */
export const adminCancelScheduled = (dispatchId: string) => adminCancelScheduledWith(operationsDeps, dispatchId);
/** 取り下げ */
export const adminRetract = (dispatchId: string) => adminRetractWith(operationsDeps, dispatchId);
/** 失敗の再送({ includeUnknown? }) */
export const adminResendFailed = (dispatchId: string, input?: unknown) => adminResendFailedWith(operationsDeps, dispatchId, input);

/** 回の読む口の部品(1 件は操作ができるかも返す) */
const readDeps = {
  ...adminCheck,
  dispatchStore: drizzleAdminDispatchStore,
  async operationInputs(row: MessageDispatch) {
    const [resolved, counts] = await Promise.all([definitionOf(row), drizzleMessageOperationsStore.countFailed(null, row.id)]);
    return { policy: policyOf(resolved, row), counts };
  },
};

/** 管理の送信の部品 */
const sendDeps: AdminSendDeps = {
  ...adminCheck,
  sendMessageToMany,
  sendTemplate,
  previewMessage,
  estimateRecipients,
  recordAudit,
  serviceNameShort: () => business.serviceNameShort,
  channels,
  categories,
  audiences,
  roles: () => ALL_ROLES.map((role) => ({ id: role.id, label: role.label })),
  async listPublishedTemplates() {
    const rows = await db
      .select({
        id: MessageTemplateTable.id,
        key: MessageTemplateTable.key,
        name: MessageTemplateTable.name,
        currentVersion: MessageTemplateTable.current_version,
        category: MessageTemplateVersionTable.category,
        content: MessageTemplateVersionTable.content,
        variables: MessageTemplateVersionTable.variables,
      })
      .from(MessageTemplateTable)
      .innerJoin(
        MessageTemplateVersionTable,
        and(
          eq(MessageTemplateVersionTable.template_id, MessageTemplateTable.id),
          eq(MessageTemplateVersionTable.version, MessageTemplateTable.current_version),
        ),
      )
      .where(and(eq(MessageTemplateTable.status, "published"), isNotNull(MessageTemplateTable.current_version)))
      .orderBy(desc(MessageTemplateTable.updatedAt))
      .limit(200);
    return rows.map((row) => ({ ...row, currentVersion: row.currentVersion ?? 0, content: row.content as Record<string, unknown> }));
  },
  maxScheduleDays: () => messagingConfig.schedule.maxDaysAhead,
};

/** 管理の送信(テンプレートかその場で書く連絡、今か予約) */
export const adminSend = (input: unknown) => adminSendWith(sendDeps, input);
/** 描いたプレビュー(見本 = 操作した管理者) */
export const adminSendPreview = (input: unknown) => adminSendPreviewWith(sendDeps, input);
/** 宛先数の見込み */
export const adminSendEstimate = (input: unknown) => adminSendEstimateWith(sendDeps, input);
/** 自分へのテスト送信 */
export const adminSendTest = (input: unknown) => adminSendTestWith(sendDeps, input);
/** 送る画面の選択肢 */
export const adminSendOptions = () => adminSendOptionsWith(sendDeps);

/** 回の一覧 */
export function listDispatches(query?: ListDispatchesQuery) {
  return listDispatchesWith(readDeps, query);
}

/** 回 1 件 */
export function findDispatch(id: string) {
  return findDispatchWith(readDeps, id);
}

/** 回の配達 */
export function listDeliveries(dispatchId: string, query?: ListDeliveriesQuery) {
  return listDeliveriesWith(readDeps, dispatchId, query);
}

/** 管理の「続きを送る」 */
export function adminContinueSending(dispatchId: string) {
  return adminContinueSendingWith({ ...adminCheck, continueSending, recordAudit }, dispatchId);
}

export { AdminBulkSendInputSchema, ADMIN_BULK_SEND_MAX_RECIPIENTS } from "./bulkSend";
export { ListDeliveriesQuerySchema, ListDispatchesQuerySchema } from "./readDispatches";
export type { AdminBulkSendInput, AdminBulkSendOptions, AdminBulkSendResult } from "./bulkSend";
export { ADMIN_SEND_MAX_USERS } from "./send";
export {
  ADMIN_FREE_TEXT_DEFINITIONS,
  ADMIN_FREE_TEXT_KINDS,
  ADMIN_FREE_TEXT_MESSAGE_KEYS,
  adminFreeTextMessageKeyOf,
} from "./freeText";
export type { AdminFreeTextCategoryOption, AdminFreeTextKind } from "./freeText";
export { AdminResendInputSchema } from "./operations";
export type {
  AdminCancelResult,
  AdminResendResult,
  AdminRetractResult,
  DispatchOperationFlag,
  DispatchOperationFlags,
  DispatchOperationReason,
} from "./operations";
export type {
  AdminSendEstimateInput,
  AdminSendInput,
  AdminSendOptions,
  AdminSendPreviewInput,
  AdminSendResult,
  AdminSendTestInput,
} from "./send";
export type { AdminPage, ListDeliveriesQuery, ListDispatchesQuery } from "./readDispatches";
export type { AdminDeliveryRow, AdminDispatchDetail, AdminDispatchSummary } from "./dispatchDto";
export type { AdminBulkSendCounts, AdminMessageContent, AdminMessageChannel, MessageBulkSendTarget } from "./types";
