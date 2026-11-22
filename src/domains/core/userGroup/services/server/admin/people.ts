// src/domains/core/userGroup/services/server/admin/people.ts
//
// 人を探して足し外しする口の SQL(D101)。グループの確かめ・監査・人数の上限は adminService が持つ。
// - 探す: 削除していない利用者を名前かメールアドレスの部分一致(管理の利用者の選択の既定 name / email と同じ)で、利用者 id の順の keyset。
//   1 人ずつに対象の静的グループ(固定グループの一員 / 例外の足す人・外す人)に入っているか、例外の反対側に入っているかを付ける。
//   id の一覧を丸ごとは返さない
// - 足し外し: 呼び手の取引の中で外す → 足す(居る・削除していない利用者だけ、もう入っていれば何もしない)。
//   例外の片側へ足した人は反対側から外す(動いた数を返す)

import { and, asc, eq, gt, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";

import { UserTable } from "@/domains/core/user/entities/drizzle";

import { UserGroupMemberTable } from "../../../entities/drizzle";
import type { Executor } from "../writes/versionWriter";

const M = UserGroupMemberTable;

/** 名前かメールアドレスの部分一致の述語(% _ \ は文字として探す) */
export function personMatch(q: string | undefined): SQL | undefined {
  if (!q) return undefined;
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return or(ilike(UserTable.name, pattern), ilike(UserTable.email, pattern));
}

function inGroup(groupId: string | null): SQL<boolean> {
  if (!groupId) return sql<boolean>`false`;
  return sql<boolean>`exists (select 1 from ${M} where ${M.group_id} = ${groupId} and ${M.user_id} = ${UserTable.id})`;
}

/** 探した 1 頁(limit + 1 件読む。呼び手が次の印を作る) */
export async function searchPeopleRows(
  db: Executor,
  input: { targetGroupId: string | null; otherGroupId: string | null; q?: string; after: string | null; limit: number },
): Promise<{ id: string; name: string | null; inList: boolean; inOther: boolean }[]> {
  const rows = await db
    .select({ id: UserTable.id, name: UserTable.name, inList: inGroup(input.targetGroupId), inOther: inGroup(input.otherGroupId) })
    .from(UserTable)
    .where(and(isNull(UserTable.deletedAt), personMatch(input.q), input.after ? gt(UserTable.id, input.after) : undefined))
    .orderBy(asc(UserTable.id))
    .limit(input.limit + 1);
  return rows.map((row) => ({ id: row.id, name: row.name ?? null, inList: Boolean(row.inList), inOther: Boolean(row.inOther) }));
}

/** 静的グループの今の人数(削除した利用者は数えない) */
export async function memberCountIn(db: Executor, groupId: string): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(M)
    .innerJoin(UserTable, eq(UserTable.id, M.user_id))
    .where(and(eq(M.group_id, groupId), isNull(UserTable.deletedAt)));
  return Number(row?.value ?? 0);
}

/**
 * 呼び手の取引の中で足し外しする(外す → 足す)。otherGroupId があれば足した人を反対側から外す。
 * @returns 足した・外した・反対側から動いた数
 */
export async function applyPeopleIn(
  tx: Executor,
  input: { groupId: string; otherGroupId: string | null; add: readonly string[]; remove: readonly string[]; batchSize: number },
): Promise<{ added: number; removed: number; moved: number }> {
  const size = Math.max(1, input.batchSize);
  let removed = 0;
  let added = 0;
  let moved = 0;
  for (let start = 0; start < input.remove.length; start += size) {
    const rows = await tx
      .delete(M)
      .where(and(eq(M.group_id, input.groupId), inArray(M.user_id, input.remove.slice(start, start + size))))
      .returning({ id: M.user_id });
    removed += rows.length;
  }
  for (let start = 0; start < input.add.length; start += size) {
    const present = await tx
      .select({ id: UserTable.id })
      .from(UserTable)
      .where(and(inArray(UserTable.id, input.add.slice(start, start + size)), isNull(UserTable.deletedAt)));
    if (present.length === 0) continue;
    const ids = present.map((row) => row.id);
    const rows = await tx
      .insert(M)
      .values(ids.map((id) => ({ group_id: input.groupId, user_id: id })))
      .onConflictDoNothing()
      .returning({ id: M.user_id });
    added += rows.length;
    if (input.otherGroupId) {
      const out = await tx
        .delete(M)
        .where(and(eq(M.group_id, input.otherGroupId), inArray(M.user_id, ids)))
        .returning({ id: M.user_id });
      moved += out.length;
    }
  }
  return { added, removed, moved };
}
