// src/features/core/interactionTracking/services/server/wrappers/getAudience.ts

import { and, eq, isNotNull, sql } from "drizzle-orm";

import {
  InteractionCounterTable,
  InteractionEventTable,
} from "@/features/core/interactionTracking/entities/drizzle";
import type {
  InteractionAudienceEntry,
  InteractionAudienceOrderBy,
  InteractionAudienceSummaryMap,
} from "@/features/core/interactionTracking/entities/model";
import { UserTable } from "@/features/core/user/entities/drizzle";
import type { PaginatedResult } from "@/lib/crud/types";
import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors/domainError";

const MAX_LIMIT = 100;

export const AUDIENCE_ORDER_BY = ["lastClickedAt", "clickCount"] as const satisfies readonly InteractionAudienceOrderBy[];
export type AudienceOrderBy = InteractionAudienceOrderBy;

export type GetAudienceOptions = {
  action: string;
  /** 1 始まり。既定 1 */
  page?: number;
  /** 既定 50・上限 100 */
  limit?: number;
  /** 既定 "lastClickedAt"（新しい順）。"clickCount" で回数順 */
  orderBy?: AudienceOrderBy;
};

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/**
 * 「target X を誰がクリックしたか」のオーディエンス一覧を取得する。
 *
 * - データ源はイベント明細（interaction_events）の user_id IS NOT NULL 行。
 *   匿名イベントは対象外（人数化できないため。件数は getAudienceSummary が返す）
 * - ユーザー単位に GROUP BY し、回数（COUNT）と最終日時（MAX(created_at)）を集約。
 *   users を JOIN して表示名 / メールを付与する
 * - 保持期限（retention_days）を過ぎた明細は prune 済みのため含まれない。
 *   recordDetail:false の targetType は明細が無いため常に空になる
 *
 * セキュリティ: ユーザー PII（名前・メール）を含むためサーバー専用。
 * 公開経路は admin 限定ルート（/api/admin/interactions/audience）のみとすること。
 */
export async function getAudience(
  targetType: string,
  targetId: string,
  options: GetAudienceOptions,
): Promise<PaginatedResult<InteractionAudienceEntry>> {
  const action = options.action?.trim();
  if (!action) {
    throw new DomainError("action は必須です。", { status: 400 });
  }

  const page = options.page ?? 1;
  const limit = options.limit ?? 50;
  if (!Number.isInteger(page) || page < 1) {
    throw new DomainError("page は 1 以上の整数で指定してください。", { status: 400 });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new DomainError(`limit は 1〜${MAX_LIMIT} の整数で指定してください。`, { status: 400 });
  }

  const orderBy = options.orderBy ?? "lastClickedAt";
  if (!AUDIENCE_ORDER_BY.includes(orderBy)) {
    throw new DomainError("orderBy の指定が不正です。", { status: 400 });
  }

  const conditions = and(
    eq(InteractionEventTable.targetType, targetType),
    eq(InteractionEventTable.targetId, targetId),
    eq(InteractionEventTable.action, action),
    isNotNull(InteractionEventTable.userId),
  );

  const orderExpr =
    orderBy === "clickCount"
      ? sql`count(*) DESC, max(${InteractionEventTable.createdAt}) DESC`
      : sql`max(${InteractionEventTable.createdAt}) DESC`;

  const [totalRows, rows] = await Promise.all([
    db
      .select({
        value: sql<string>`count(distinct ${InteractionEventTable.userId})`,
      })
      .from(InteractionEventTable)
      .where(conditions),
    db
      .select({
        userId: InteractionEventTable.userId,
        name: UserTable.name,
        email: UserTable.email,
        clickCount: sql<string>`count(*)`,
        lastClickedAt: sql<string>`max(${InteractionEventTable.createdAt})`,
      })
      .from(InteractionEventTable)
      .leftJoin(UserTable, eq(InteractionEventTable.userId, UserTable.id))
      .where(conditions)
      .groupBy(InteractionEventTable.userId, UserTable.name, UserTable.email)
      .orderBy(orderExpr)
      .limit(limit)
      .offset((page - 1) * limit),
  ]);

  return {
    total: Number(totalRows[0]?.value ?? 0),
    results: rows.map((row) => ({
      userId: row.userId ?? "",
      name: row.name,
      email: row.email,
      clickCount: Number(row.clickCount),
      lastClickedAt: toIsoString(row.lastClickedAt),
    })),
  };
}

/**
 * 対象 1 件のオーディエンスサマリーを action 別に取得する。
 *
 * - lifetimeTotal: 累計カウンタ由来（永久・prune の影響を受けない）
 * - loggedInCount / anonymousCount: イベント明細由来（保持期限内のみ）。
 *   このため prune 後は lifetimeTotal と内訳合計が乖離するのが正常な状態。
 *   削除ユーザーのイベントは ON DELETE SET NULL で匿名側に合流する
 */
export async function getAudienceSummary(
  targetType: string,
  targetId: string,
): Promise<InteractionAudienceSummaryMap> {
  const [counterRows, eventRows] = await Promise.all([
    db
      .select({
        action: InteractionCounterTable.action,
        total: sql<string>`sum(${InteractionCounterTable.count})`,
      })
      .from(InteractionCounterTable)
      .where(
        and(
          eq(InteractionCounterTable.targetType, targetType),
          eq(InteractionCounterTable.targetId, targetId),
        ),
      )
      .groupBy(InteractionCounterTable.action),
    db
      .select({
        action: InteractionEventTable.action,
        total: sql<string>`count(*)`,
        // count(col) は NULL を数えないため、そのまま「ログイン済み件数」になる
        loggedIn: sql<string>`count(${InteractionEventTable.userId})`,
      })
      .from(InteractionEventTable)
      .where(
        and(
          eq(InteractionEventTable.targetType, targetType),
          eq(InteractionEventTable.targetId, targetId),
        ),
      )
      .groupBy(InteractionEventTable.action),
  ]);

  const summary: InteractionAudienceSummaryMap = {};

  for (const row of counterRows) {
    summary[row.action] = {
      lifetimeTotal: Number(row.total),
      loggedInCount: 0,
      anonymousCount: 0,
    };
  }
  for (const row of eventRows) {
    const entry = (summary[row.action] ??= {
      lifetimeTotal: 0,
      loggedInCount: 0,
      anonymousCount: 0,
    });
    const total = Number(row.total);
    const loggedIn = Number(row.loggedIn);
    entry.loggedInCount = loggedIn;
    entry.anonymousCount = total - loggedIn;
  }

  return summary;
}
