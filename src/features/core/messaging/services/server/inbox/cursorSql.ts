// src/features/core/messaging/services/server/inbox/cursorSql.ts
//
// 受け取り箱の keyset の条件(store.ts が使う。db を持たないので検査 rawSqlParams.test.ts が組み立てて値を確かめる)。
// 生の sql`` に JS の Date を渡さない: ISO の文字列 + ::timestamptz で渡す

import { sql, type SQL } from "drizzle-orm";

import { MessageInboxItemTable } from "../../../entities/inbox";

/** (published_at, id) が印より前(新しい順の続き) */
export function inboxBeforeSql(before: { publishedAt: Date; id: string }): SQL {
  const I = MessageInboxItemTable;
  return sql`(${I.published_at}, ${I.id}) < (${before.publishedAt.toISOString()}::timestamptz, ${before.id}::uuid)`;
}
