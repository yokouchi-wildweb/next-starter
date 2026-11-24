// src/domains/core/messaging/services/server/dispatchSentBy.ts
//
// 誰が送った送信か(types/dispatchSentBy.ts)の条件の SQL。送信の一覧(admin/store.ts)と利用者ごとの履歴(history/store.ts)が同じ線を使う
// - admin = actor_type が admin / system = それ以外(null を含む)/ 無し = 絞らない

import { eq, isNull, ne, or, type SQL } from "drizzle-orm";

import { MessageDispatchTable } from "../../entities/drizzle";
import type { DispatchSentBy } from "../../types/dispatchSentBy";

export function dispatchSentBySql(sentBy: DispatchSentBy | null | undefined): SQL | undefined {
  const t = MessageDispatchTable;
  if (sentBy === "admin") return eq(t.actor_type, "admin");
  if (sentBy === "system") return or(isNull(t.actor_type), ne(t.actor_type, "admin"));
  return undefined;
}
