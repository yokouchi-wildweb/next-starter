// src/domains/core/userGroup/services/server/admin/references.ts
//
// グループを使っている所(削除の可否、D92)。読むだけ。
// - 送信の宛先: messaging の送信(message_dispatches)のうち、宛先がこのグループで削除していない送信の数。
//   messaging を import しない(循環を作らない)ため、表と列の名前で読む生の SQL(target jsonb {type:'group', groupId}・deleted_at)
// - 他のグループの条件: 保存した定義の木に「固定グループの一員」(inStaticGroup)でこのグループを指す葉がある、ほかのグループの名前
//   (削除の対象は持ち主付きでないグループだけ。持ち主の包みが指す例外の人のグループは持ち主と一緒に消える)

import { and, eq, ne, sql } from "drizzle-orm";

import { UserGroupDefinitionTable, UserGroupTable } from "../../../entities/drizzle";
import type { Executor } from "../writes/versionWriter";

export type UserGroupReferences = {
  /** 宛先がこのグループの、削除していない送信の数 */
  dispatches: number;
  /** 条件でこのグループを使っているほかのグループの名前 */
  groups: string[];
};

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: T[] }).rows ?? []) as T[];
}

/** グループを使っている所を読む */
export async function referencesOf(db: Executor, groupId: string): Promise<UserGroupReferences> {
  const dispatchRows = rowsOf<{ count: number | string }>(
    await db.execute(sql`
      SELECT count(*)::int AS count FROM message_dispatches
      WHERE target->>'type' = 'group' AND target->>'groupId' = ${groupId} AND deleted_at IS NULL
    `),
  );
  const G = UserGroupTable;
  const D = UserGroupDefinitionTable;
  const groups = await db
    .select({ name: G.name })
    .from(D)
    .innerJoin(G, eq(G.id, D.group_id))
    .where(
      and(
        ne(D.group_id, groupId),
        sql`jsonb_path_exists(${D.tree}, '$.** ? (@.part == "inStaticGroup" && @.args.groupId == $gid)', jsonb_build_object('gid', ${groupId}::text))`,
      ),
    )
    .orderBy(G.name);
  return { dispatches: Number(dispatchRows[0]?.count ?? 0), groups: groups.map((row) => row.name) };
}

/** 削除できない理由の文(画面の行の操作と 409 の文が同じ物を読む)。空 = 削除できる */
export function deleteReasonsOf(references: UserGroupReferences): string[] {
  const reasons: string[] = [];
  if (references.dispatches > 0) reasons.push(`送信 ${references.dispatches} 件の宛先になっています(先に送信を削除してください)`);
  if (references.groups.length > 0) {
    reasons.push(`グループ${references.groups.map((name) => `「${name}」`).join("")}の条件で使われています`);
  }
  return reasons;
}
