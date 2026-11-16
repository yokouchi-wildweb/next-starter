// src/features/core/userGroup/services/server/evaluation/compile.ts
// 条件の定義の木 → users への 1 つの SQL の述語(D103)。葉 = 部品の where(今の zod で通した引数, { now })、and / or / not はそのまま。
// 1 回の評価は 1 つの now を全部の葉に渡す。母集団(削除されていない利用者)は呼び手(evaluator)が足す。
// 壊れた葉(部品が無い・引数が今の zod に合わない): 保存したグループ = 409、その場の定義 = 400(DomainError)

import { and, not, or, type SQL } from "drizzle-orm";

import { DomainError } from "@/lib/errors";

import type { UserGroupDefinitionNode } from "../../../entities/schema";
import type { UserGroupCriterion } from "../../../types/criterion";

export type CompileOptions = {
  criteria: Readonly<Record<string, UserGroupCriterion>>;
  now: Date;
  /** stored = 保存したグループ(壊れていれば 409)/ inline = その場の定義(400) */
  source: "stored" | "inline";
};

export function compileUserGroupDefinition(tree: UserGroupDefinitionNode, options: CompileOptions): SQL {
  const status = options.source === "stored" ? 409 : 400;
  const broken = (message: string) =>
    new DomainError(options.source === "stored" ? `グループの条件が正しくありません: ${message}` : message, { status });

  const walk = (node: UserGroupDefinitionNode, path: string): SQL => {
    if ("part" in node) {
      const criterion = options.criteria[node.part];
      if (!criterion) throw broken(`条件の部品 ${node.part} はありません(${path})`);
      const args = criterion.args.safeParse(node.args ?? {});
      if (!args.success) {
        throw broken(`条件「${criterion.label}」の値が今の形に合いません(${path}: ${args.error.issues[0]?.message ?? "不明"})`);
      }
      return criterion.where(args.data, { now: options.now });
    }
    if (node.op === "not") return not(walk(node.child, `${path}.child`));
    const parts = node.children.map((child, index) => walk(child, `${path}.children.${index}`));
    return (node.op === "and" ? and(...parts) : or(...parts))!;
  };

  return walk(tree, "根");
}
