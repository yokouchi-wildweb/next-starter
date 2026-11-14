// src/features/core/userGroup/entities/schema.ts
// ユーザーグループの値の一覧と、条件の定義の木の形(zod)。DB を読まない

import { z } from "zod";

/** グループの種類(D103): dynamic = 条件を保存し使う時に引く / scheduled = cron が計算した版を使う / static = 利用者 id の並び */
export const USER_GROUP_KINDS = ["dynamic", "scheduled", "static"] as const;
export type UserGroupKind = (typeof USER_GROUP_KINDS)[number];

/** グループの状態: active = 使える / archived = 残すが選択肢に出さず、新しい宛先・条件に使えない */
export const USER_GROUP_STATUSES = ["active", "archived"] as const;
export type UserGroupStatus = (typeof USER_GROUP_STATUSES)[number];

/** 定期計算の版の状態: computing = 計算中 / ready = 計算し終えた(今の版にできる)/ failed = 失敗(誤りを持ち返す) */
export const USER_GROUP_VERSION_STATUSES = ["computing", "ready", "failed"] as const;
export type UserGroupVersionStatus = (typeof USER_GROUP_VERSION_STATUSES)[number];

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
