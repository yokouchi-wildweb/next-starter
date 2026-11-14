// src/features/core/userGroup/services/server/admin/schema.ts
// 管理の API の入力の形(zod)。条件の定義の木の中身(部品の鍵と引数・上限)は checkUserGroupDefinition が見る

import { z } from "zod";

import { USER_GROUP_KINDS, USER_GROUP_STATUSES } from "../../../entities/schema";

const uuid = z.string().uuid();
const name = z.string().trim().min(1).max(100);
const description = z.string().trim().max(500).nullable().optional();
/** 定期計算の間隔(分): 1 時間〜30 日(cron は毎時なので 60 分より細かくしない)。null = 設定の既定 */
const interval = z.number().int().min(60).max(43_200).nullable().optional();
const userIds = z.array(uuid).max(1_000_000);

export const ListUserGroupsQuerySchema = z.object({
  kind: z.enum(USER_GROUP_KINDS).optional(),
  status: z.enum(USER_GROUP_STATUSES).default("active"),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const CreateUserGroupInputSchema = z
  .object({
    name,
    description,
    kind: z.enum(USER_GROUP_KINDS),
    definition: z.unknown().optional(),
    recomputeIntervalMinutes: interval,
  })
  .strict();

export const UpdateUserGroupInputSchema = z
  .object({
    name: name.optional(),
    description,
    kind: z.enum(USER_GROUP_KINDS).optional(),
    definition: z.unknown().optional(),
    recomputeIntervalMinutes: interval,
  })
  .strict();

/** { groupId } = 保存したグループ / { definition } = その場の定義(どちらか 1 つ) */
export const EstimateUserGroupInputSchema = z.union([
  z.object({ groupId: uuid }).strict(),
  z
    .object({ definition: z.unknown() })
    .strict()
    .refine((value) => value.definition !== undefined, { message: "definition か groupId のどちらかが要ります" }),
]);

const exceptionSide = z.object({ add: userIds.optional(), remove: userIds.optional() }).strict();
export const UpdateUserGroupExceptionsInputSchema = z
  .object({ include: exceptionSide.optional(), exclude: exceptionSide.optional() })
  .strict();

/** 静的グループの一員の元: 選んだ利用者 / 別のグループの今の一員 / タグの今の持ち主 */
export const StaticMemberSourceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("users"), userIds }).strict(),
  z.object({ type: z.literal("group"), groupId: uuid }).strict(),
  z.object({ type: z.literal("tag"), tagId: uuid }).strict(),
]);

export const CreateStaticUserGroupInputSchema = z
  .object({ name, description, from: StaticMemberSourceSchema })
  .strict();

export const UpdateStaticMembersInputSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("add"), userIds }).strict(),
  z.object({ mode: z.literal("replace"), from: StaticMemberSourceSchema }).strict(),
  z.object({ mode: z.literal("remove"), userIds }).strict(),
]);

const memberPage = {
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
};

/** 静的グループの今の一員の一覧(keyset) */
export const ListStaticMembersQuerySchema = z.object(memberPage);

/** 例外の人の一覧: side = include(足す人)| exclude(外す人) */
export const ListExceptionMembersQuerySchema = z.object({ side: z.enum(["include", "exclude"]), ...memberPage });

export type StaticMemberSource = z.infer<typeof StaticMemberSourceSchema>;
