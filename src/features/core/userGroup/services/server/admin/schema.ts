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
  /** 無ければ使用中とアーカイブの両方(D87) */
  status: z.enum(USER_GROUP_STATUSES).optional(),
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
    /** 例外の人(動的・定期計算だけ。グループと同じ取引で書く) */
    exceptions: z.object({ include: userIds.optional(), exclude: userIds.optional() }).strict().optional(),
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

/** 例外の人の片側: clear = 全員を外す(D94。足す・外すより先に)/ add / remove */
const exceptionSide = z.object({ clear: z.literal(true).optional(), add: userIds.optional(), remove: userIds.optional() }).strict();
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
  /** 全員を外す(D94。空の置き換えと同じ予算つきの書き込み) */
  z.object({ mode: z.literal("clear") }).strict(),
]);

const memberPage = {
  /** 名前かメールアドレスの部分一致(D93。利用者の選択の既定と同じ name / email) */
  q: z.string().trim().min(1).max(100).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
};

/** 静的グループの今の一員の一覧(keyset) */
export const ListStaticMembersQuerySchema = z.object(memberPage);

/** 例外の人の一覧: side = include(足す人)| exclude(外す人) */
export const ListExceptionMembersQuerySchema = z.object({ side: z.enum(["include", "exclude"]), ...memberPage });

export type StaticMemberSource = z.infer<typeof StaticMemberSourceSchema>;

/** 人を探す・足し外しする対象(D101): 固定グループの一員 / 例外の足す人 / 外す人 */
export const PeopleTargetSchema = z.enum(["members", "include", "exclude"]);

/** 人を探す(名前かメールアドレスの部分一致、利用者 id の順の keyset) */
export const PeopleSearchQuerySchema = z.object({ target: PeopleTargetSchema, ...memberPage });

/** 足し外しを 1 回で(1 つの取引)。同じ人を両方に入れると 400 */
export const PeopleApplyInputSchema = z
  .object({
    target: PeopleTargetSchema,
    add: z.array(uuid).max(10_000).default([]),
    remove: z.array(uuid).max(10_000).default([]),
  })
  .strict()
  .refine((value) => value.add.length + value.remove.length > 0, { message: "足す人か外す人を選んでください" })
  .refine((value) => !value.add.some((id) => value.remove.includes(id)), { message: "同じ人を足す・外すの両方に入れられません" });

export type PeopleTarget = z.infer<typeof PeopleTargetSchema>;
