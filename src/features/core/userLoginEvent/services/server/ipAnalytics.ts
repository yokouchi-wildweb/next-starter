// src/features/core/userLoginEvent/services/server/ipAnalytics.ts

import { sql } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { UserLoginEventTable } from "@/features/core/userLoginEvent/entities/drizzle";

/**
 * 同一 IP を利用している distinct user 数。
 *
 * 想定ユースケース:
 *  - 単一 IP に紐づくアカウント数を即座に把握 (不正運用検知の初手)
 *
 * `ip` は inet として渡される文字列。`192.168.1.1` のような単一アドレス想定。
 * btree index (ip, occurred_at) によりインデックス参照のみで完了する。
 */
export async function countDistinctUsersByIp(ip: string): Promise<number> {
  const rows = (await db.execute(sql`
    SELECT COUNT(DISTINCT ${UserLoginEventTable.userId})::int AS count
    FROM ${UserLoginEventTable}
    WHERE ${UserLoginEventTable.ip} = ${ip}::inet
  `)) as Array<{ count: number }>;
  return rows[0]?.count ?? 0;
}

export type SameIpUserRow = {
  userId: string;
  eventCount: number;
  lastSeenAt: Date;
};

export type FindUsersBySameIpOptions = {
  /** 自分自身を除外したい場合に指定 */
  excludeUserId?: string;
  /** 既定 100 */
  limit?: number;
};

/**
 * 指定 IP を利用したことのある user 一覧 (直近順)。
 */
export async function findUsersBySameIp(
  ip: string,
  options: FindUsersBySameIpOptions = {},
): Promise<SameIpUserRow[]> {
  const limit = options.limit ?? 100;
  const excludeUserId = options.excludeUserId ?? null;

  const rows = (await db.execute(sql`
    SELECT
      ${UserLoginEventTable.userId} AS "userId",
      COUNT(*)::int AS "eventCount",
      MAX(${UserLoginEventTable.occurredAt}) AS "lastSeenAt"
    FROM ${UserLoginEventTable}
    WHERE ${UserLoginEventTable.ip} = ${ip}::inet
      AND (${excludeUserId}::uuid IS NULL OR ${UserLoginEventTable.userId} <> ${excludeUserId}::uuid)
    GROUP BY ${UserLoginEventTable.userId}
    ORDER BY "lastSeenAt" DESC
    LIMIT ${limit}
  `)) as Array<{ userId: string; eventCount: number; lastSeenAt: Date | string }>;

  return rows.map((row) => ({
    userId: row.userId,
    eventCount: row.eventCount,
    lastSeenAt: row.lastSeenAt instanceof Date ? row.lastSeenAt : new Date(row.lastSeenAt),
  }));
}

export type SubnetUserRow = {
  userId: string;
  eventCount: number;
  lastSeenAt: Date;
};

export type FindUsersBySubnetOptions = {
  /** 既定 200 */
  limit?: number;
};

/**
 * 指定 CIDR (例: "192.168.1.0/24") に含まれる IP を利用したことのある user 一覧。
 *
 * PostgreSQL の `inet <<= cidr` 演算子でサブネット包含判定。
 * (ip, occurred_at) の btree index を range で活用する。
 * 大規模化したテーブルで /16 など極端に広い範囲を指定する場合は別途集計テーブル
 * (materialized view 等) の検討余地あり。
 */
export async function findUsersBySubnet(
  cidr: string,
  options: FindUsersBySubnetOptions = {},
): Promise<SubnetUserRow[]> {
  const limit = options.limit ?? 200;

  const rows = (await db.execute(sql`
    SELECT
      ${UserLoginEventTable.userId} AS "userId",
      COUNT(*)::int AS "eventCount",
      MAX(${UserLoginEventTable.occurredAt}) AS "lastSeenAt"
    FROM ${UserLoginEventTable}
    WHERE ${UserLoginEventTable.ip} <<= ${cidr}::inet
    GROUP BY ${UserLoginEventTable.userId}
    ORDER BY "lastSeenAt" DESC
    LIMIT ${limit}
  `)) as Array<{ userId: string; eventCount: number; lastSeenAt: Date | string }>;

  return rows.map((row) => ({
    userId: row.userId,
    eventCount: row.eventCount,
    lastSeenAt: row.lastSeenAt instanceof Date ? row.lastSeenAt : new Date(row.lastSeenAt),
  }));
}
