// src/features/core/userGroup/services/server/admin/exceptions.ts
// 例外の人(D103): グループが持ち主の静的グループ 2 つ(足す人・外す人、owner_group_id = グループ)を、保存する定義の木で
// 「(元の定義 or 足す人の一員) and not 外す人の一員」に包む。どれが足す人・外す人かは包んだ木だけが持つ(列は足さない)

import type { UserGroupDefinitionNode } from "../../../entities/schema";

export type ExceptionGroupIds = { includeId: string; excludeId: string };

const memberOf = (groupId: string): UserGroupDefinitionNode => ({ part: "inStaticGroup", args: { groupId } });

/** 元の定義を例外で包む */
export function wrapWithExceptions(base: UserGroupDefinitionNode, ids: ExceptionGroupIds): UserGroupDefinitionNode {
  return {
    op: "and",
    children: [
      { op: "or", children: [base, memberOf(ids.includeId)] },
      { op: "not", child: memberOf(ids.excludeId) },
    ],
  };
}

function groupIdOf(node: UserGroupDefinitionNode | undefined): string | null {
  if (!node || !("part" in node) || node.part !== "inStaticGroup") return null;
  const args = node.args as { groupId?: unknown } | undefined;
  return typeof args?.groupId === "string" ? args.groupId : null;
}

/**
 * 包んだ木から元の定義と例外のグループを取り出す。包みの形でない木はそのまま(例外なし)。
 * ownerIds = そのグループが持ち主の静的グループの id(違う id を指す同じ形の木は包みと見なさない)
 */
export function unwrapExceptions(
  tree: UserGroupDefinitionNode,
  ownerIds: ReadonlySet<string>,
): { base: UserGroupDefinitionNode; exceptions: ExceptionGroupIds | null } {
  if (!("op" in tree) || tree.op !== "and" || tree.children.length !== 2) return { base: tree, exceptions: null };
  const [either, negated] = tree.children;
  if (!either || !("op" in either) || either.op !== "or" || either.children.length !== 2) return { base: tree, exceptions: null };
  if (!negated || !("op" in negated) || negated.op !== "not") return { base: tree, exceptions: null };
  const includeId = groupIdOf(either.children[1]);
  const excludeId = groupIdOf(negated.child);
  if (!includeId || !excludeId || !ownerIds.has(includeId) || !ownerIds.has(excludeId)) return { base: tree, exceptions: null };
  return { base: either.children[0]!, exceptions: { includeId, excludeId } };
}
