// src/domains/core/userGroup/entities/userGroupDefinition/schema.ts

import { z } from "zod";

/**
 * 条件の定義の木(D103): and / or は子の並び、not は子 1 つ、葉は条件の部品の鍵と引数。任意の深さ(上限は設定の値)。
 * 形だけを確かめる(部品の鍵と引数・上限は services/server/definition/checkDefinition.ts)
 */
export type UserGroupDefinitionNode =
  | { op: "and" | "or"; children: UserGroupDefinitionNode[] }
  | { op: "not"; child: UserGroupDefinitionNode }
  | { part: string; args?: unknown };
export const UserGroupDefinitionNodeSchema: z.ZodType<UserGroupDefinitionNode> = z.lazy(() =>
  z.union([
    z.object({ op: z.enum(["and", "or"]), children: z.array(UserGroupDefinitionNodeSchema).min(1) }).strict(),
    z.object({ op: z.literal("not"), child: UserGroupDefinitionNodeSchema }).strict(),
    z.object({ part: z.string().trim().min(1).max(100), args: z.unknown().optional() }).strict(),
  ]),
);
