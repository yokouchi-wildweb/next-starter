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
import { MessageTemplateTable, MessageTemplateVersionTable } from "../../../entities/template";
import { audiences } from "../../../extensions/audiences";
import { bulkSendTargets } from "../../../extensions/bulkSendTargets";
import { channels } from "../../../extensions/channels";
import { estimateRecipients, previewMessage, sendMessageToMany, sendTemplate } from "../sendMessage";
import { continueSending } from "../sweep";
import type { AdminCheckDeps } from "./assertAdmin";
import { adminBulkSend as adminBulkSendWith, type AdminBulkSendInput } from "./bulkSend";
import { adminContinueSending as adminContinueSendingWith } from "./continueSending";
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

/** 管理の一括送信(連絡 messaging.adminMessage) */
export function adminBulkSend(input: AdminBulkSendInput) {
  return adminBulkSendWith(
    {
      ...adminCheck,
      targets: bulkSendTargets,
      sendMessageToMany,
      recordAudit,
      serviceNameShort: () => business.serviceNameShort,
    },
    input,
  );
}

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
        channels: MessageTemplateVersionTable.channels,
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
    return rows.map((row) => ({ ...row, currentVersion: row.currentVersion ?? 0, channels: [...row.channels] }));
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
  return listDispatchesWith({ ...adminCheck, dispatchStore: drizzleAdminDispatchStore }, query);
}

/** 回 1 件 */
export function findDispatch(id: string) {
  return findDispatchWith({ ...adminCheck, dispatchStore: drizzleAdminDispatchStore }, id);
}

/** 回の配達 */
export function listDeliveries(dispatchId: string, query?: ListDeliveriesQuery) {
  return listDeliveriesWith({ ...adminCheck, dispatchStore: drizzleAdminDispatchStore }, dispatchId, query);
}

/** 管理の「続きを送る」 */
export function adminContinueSending(dispatchId: string) {
  return adminContinueSendingWith({ ...adminCheck, continueSending, recordAudit }, dispatchId);
}

export { AdminBulkSendInputSchema, ADMIN_BULK_SEND_MAX_RECIPIENTS } from "./bulkSend";
export { ListDeliveriesQuerySchema, ListDispatchesQuerySchema } from "./readDispatches";
export type { AdminBulkSendInput, AdminBulkSendResult } from "./bulkSend";
export { ADMIN_SEND_MAX_USERS, assertAdminSendKind } from "./send";
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
