// src/features/core/userGroup/services/server/definition/checkDefinition.ts
// 条件の定義の木の検査(D103)。and / or / not の任意の木、節の数と深さの上限(設定の値)、知らない部品の鍵・引数の zod の誤りは
// DomainError(400、どの節かを path で言う)。heavy の部品を含むかを返す(含む動的グループは 1 人の確かめを拒む、定期計算なら使える)。
// DB を読まない(部品の一覧と上限は呼び手が渡す。本物は extensions/criteria と userGroupConfig)

import { DomainError } from "@/lib/errors";

import { UserGroupDefinitionNodeSchema, type UserGroupDefinitionNode } from "../../../entities/schema";
import type { UserGroupCriterion } from "../../../types/criterion";

export type UserGroupDefinitionLimits = { maxNodes: number; maxDepth: number };

export type UserGroupDefinitionCheck = {
  /** heavy の部品を含むか */
  heavy: boolean;
  /** 節の数(and / or / not と葉の全部) */
  nodes: number;
  /** 深さ(根 = 1) */
  depth: number;
  /** 使った部品の鍵(重なりなし、出てきた順) */
  parts: string[];
};

const invalid = (message: string) => new DomainError(message, { status: 400 });

/**
 * @throws DomainError(400) 形の誤り・節の数 / 深さの上限・知らない部品の鍵・引数の誤り
 */
export function checkUserGroupDefinition(
  tree: unknown,
  options: { criteria: Readonly<Record<string, UserGroupCriterion>>; limits: UserGroupDefinitionLimits },
): UserGroupDefinitionCheck {
  const shape = UserGroupDefinitionNodeSchema.safeParse(tree);
  if (!shape.success) {
    const issue = shape.error.issues[0];
    throw invalid(`条件の定義の形が正しくありません(${issue?.path.join(".") || "根"}: ${issue?.message ?? "不明"})`);
  }
  const { maxNodes, maxDepth } = options.limits;
  let nodes = 0;
  let depth = 0;
  let heavy = false;
  const parts: string[] = [];

  const walk = (node: UserGroupDefinitionNode, level: number, path: string): void => {
    nodes += 1;
    depth = Math.max(depth, level);
    if (nodes > maxNodes) throw invalid(`条件の節は ${maxNodes} 個までです`);
    if (level > maxDepth) throw invalid(`条件の深さは ${maxDepth} 段までです(${path})`);
    if ("part" in node) {
      const criterion = options.criteria[node.part];
      if (!criterion) throw invalid(`条件の部品 ${node.part} はありません(${path})`);
      const args = criterion.args.safeParse(node.args ?? {});
      if (!args.success) {
        const issue = args.error.issues[0];
        throw invalid(
          `条件「${criterion.label}」の値が正しくありません(${path}${issue?.path.length ? `.args.${issue.path.join(".")}` : ".args"}: ${issue?.message ?? "不明"})`,
        );
      }
      if (criterion.weight === "heavy") heavy = true;
      if (!parts.includes(node.part)) parts.push(node.part);
      return;
    }
    if (node.op === "not") {
      walk(node.child, level + 1, `${path}.child`);
      return;
    }
    node.children.forEach((child, index) => walk(child, level + 1, `${path}.children.${index}`));
  };

  walk(shape.data, 1, "根");
  return { heavy, nodes, depth, parts };
}
