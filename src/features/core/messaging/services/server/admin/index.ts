// src/features/core/messaging/services/server/admin/index.ts
//
// 管理の送信と読む口(本物の部品を結ぶ)。呼び手は messagingService の admin* / listDispatches など。
// 管理 API: src/app/api/admin/messaging/**(README「管理の送信と回の読む口」)

import { eq } from "drizzle-orm";

import { business } from "@/business";
import { getAuditContext } from "@/lib/audit";
import { db } from "@/lib/drizzle";

import { auditLogger } from "@/features/core/auditLog/services/server";
import { getRoleCategory } from "@/features/core/user/constants";
import { UserTable } from "@/features/core/user/entities/drizzle";

import { bulkSendTargets } from "../../../extensions/bulkSendTargets";
import { sendMessageToMany } from "../sendMessage";
import { continueSending } from "../sweep";
import type { AdminCheckDeps } from "./assertAdmin";
import { adminBulkSend as adminBulkSendWith, type AdminBulkSendInput } from "./bulkSend";
import { adminContinueSending as adminContinueSendingWith } from "./continueSending";
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
export type { AdminPage, ListDeliveriesQuery, ListDispatchesQuery } from "./readDispatches";
export type { AdminDeliveryRow, AdminDispatchDetail, AdminDispatchSummary } from "./dispatchDto";
export type { AdminBulkSendCounts, AdminMessageContent, AdminMessageChannel, MessageBulkSendTarget } from "./types";
