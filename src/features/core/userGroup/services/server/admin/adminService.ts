// src/features/core/userGroup/services/server/admin/adminService.ts
// ユーザーグループの管理の service(D99・D102・D103)。/api/admin/user-groups/** が呼ぶ。部品を受けて作る(--db のテストは戻す取引を渡す)。
// - 一覧(新しい順・keyset、種類・状態で絞る、人数、定期計算の最後の時刻と失敗。例外の持ち主付きのグループは出さない)と 1 件
// - 作る・直す(名前・説明・種類・条件の定義の木・定期計算の間隔)・保管。種類の付け替えは動的 ⇄ 定期計算だけ(静的との間は 409)
// - 見込みと試しの一覧(その場の定義か保存したグループ。id と表示名だけ、時間の上限で 503)
// - 例外の人(足す人・外す人 = 持ち主付きの静的グループ、定義を包む。exceptions.ts)
// - 静的グループ: 選んだ利用者・別のグループの今の一員・タグの今の持ち主から作る・置き換える(予算つき、終わらなければ incomplete)、足す・外す
// - 一員の一覧(静的)と例外の人の一覧(足す人・外す人)。利用者 id の順の keyset、id と表示名だけ、消した利用者は出さない
// - 条件の部品の一覧(表示名・欄・重さと、ロール・状態・タグ・静的グループの選択肢)
// - service でも管理者を確かめる。監査 user_group.group.{created, updated, archived, restored}・user_group.exceptions.updated・
//   user_group.members.{replaced, added, removed}(操作した管理者が actor。利用者 id は監査に入れない)

import { and, asc, desc, eq, gt, ilike, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { z } from "zod";

import { UserTable, UserToUserTagTable } from "@/features/core/user/entities/drizzle";
import { UserTagTable } from "@/features/core/userTag/entities/drizzle";
import type { AuditRecordInput } from "@/lib/audit";
import { createDeadline } from "@/lib/cron";
import { DomainError } from "@/lib/errors";

import type { UserGroupConfig } from "../../../config";
import {
  UserGroupDefinitionTable,
  UserGroupMemberTable,
  UserGroupTable,
  UserGroupVersionTable,
} from "../../../entities/drizzle";
import type { UserGroup, UserGroupDefinition } from "../../../entities/model";
import type { UserGroupDefinitionNode, UserGroupKind } from "../../../entities/schema";
import type { UserGroupCriterion } from "../../../types/criterion";
import { checkUserGroupDefinition } from "../definition/checkDefinition";
import type { UserGroupEvaluator } from "../evaluation/evaluator";
import type { StaticMemberWriter } from "../writes/staticMembers";
import { arraySupplier, type Executor, type UserIdSupplier } from "../writes/versionWriter";
import { assertUserGroupAdmin, type UserGroupAdminCheckDeps } from "./assertAdmin";
import {
  USER_GROUP_KIND_LABELS,
  USER_GROUP_STATUS_LABELS,
  type AdminStaticGroupResult,
  type AdminUserGroupCount,
  type AdminUserGroupCriteriaCatalog,
  type AdminUserGroupDeleted,
  type AdminUserGroupPeopleApplied,
  type AdminUserGroupPeoplePage,
  type AdminUserGroupDetail,
  type AdminStaticMembersRemoved,
  type AdminUserGroupEstimate,
  type AdminUserGroupMemberPage,
  type AdminUserGroupOption,
  type AdminUserGroupPage,
  type AdminUserGroupRecompute,
  type AdminUserGroupSummary,
} from "./dto";
import { unwrapExceptions, wrapWithExceptions, type ExceptionGroupIds } from "./exceptions";
import { applyPeopleIn, memberCountIn, searchPeopleRows } from "./people";
import { deleteReasonsOf, referencesOf } from "./references";
import {
  CreateStaticUserGroupInputSchema,
  CreateUserGroupInputSchema,
  EstimateUserGroupInputSchema,
  ListExceptionMembersQuerySchema,
  PeopleApplyInputSchema,
  PeopleSearchQuerySchema,
  type PeopleTarget,
  ListStaticMembersQuerySchema,
  ListUserGroupsQuerySchema,
  UpdateStaticMembersInputSchema,
  UpdateUserGroupExceptionsInputSchema,
  UpdateUserGroupInputSchema,
  type StaticMemberSource,
} from "./schema";

export type UserGroupAdminDeps = UserGroupAdminCheckDeps & {
  db: Executor;
  criteria: Readonly<Record<string, UserGroupCriterion>>;
  config: UserGroupConfig;
  /** 評価の口(見込み・試しの一覧・別のグループの一員の列挙) */
  evaluator: UserGroupEvaluator;
  /** 一覧で動的グループを数える評価の口(時間の上限 = admin.listCountTimeoutMs) */
  listEvaluator: UserGroupEvaluator;
  /** 静的グループへ書く口 */
  writer: StaticMemberWriter;
  recordAudit: (input: AuditRecordInput) => Promise<unknown>;
  now: () => Date;
};

type Cursor = { createdAt: Date; id: string };

function encodeCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`, "utf8").toString("base64url");
}

function decodeCursor(cursor: string | undefined): Cursor | null {
  if (!cursor) return null;
  const [time, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const createdAt = new Date(time ?? "");
  if (!id || Number.isNaN(createdAt.getTime())) throw new DomainError("cursor が正しくありません", { status: 400 });
  return { createdAt, id };
}

/** 一員の一覧の cursor = 最後の利用者 id(base64url) */
function encodeMemberCursor(userId: string): string {
  return Buffer.from(userId, "utf8").toString("base64url");
}

function decodeMemberCursor(cursor: string | undefined): string | null {
  if (!cursor) return null;
  const id = Buffer.from(cursor, "base64url").toString("utf8");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new DomainError("cursor が正しくありません", { status: 400 });
  return id;
}

function parseOr400<S extends z.ZodTypeAny>(schema: S, value: unknown, message: string): z.output<S> {
  const parsed = schema.safeParse(value ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new DomainError(`${message}${issue ? `(${issue.path.join(".") || "入力"}: ${issue.message})` : ""}`, { status: 400 });
  }
  return parsed.data;
}

const iso = (value: Date | null | undefined) => (value ? value.toISOString() : null);

const HEAVY_NOTICE = "処理が重い条件を含むため、1 人ずつの判定(このユーザーがメンバーか)には使えません。「定期的に更新」にすると使えます";
const SCHEDULED_NOTICE = "メンバーは定期的な集計の結果です。条件や例外の変更は、次の更新(毎時。Vercel Hobby では 1 日 1 回)の後に反映されます";
const NO_VERSION_NOTICE = "まだ集計されていません。次の更新の後に人数とメンバーが表示されます";

/** 木の中の「静的グループの一員」の葉が指すグループ id */
function staticGroupRefs(tree: UserGroupDefinitionNode, out: Set<string> = new Set()): Set<string> {
  if ("part" in tree) {
    const groupId = (tree.args as { groupId?: unknown } | undefined)?.groupId;
    if (tree.part === "inStaticGroup" && typeof groupId === "string") out.add(groupId);
  } else if (tree.op === "not") staticGroupRefs(tree.child, out);
  else for (const child of tree.children) staticGroupRefs(child, out);
  return out;
}

export function createUserGroupAdminService(deps: UserGroupAdminDeps) {
  const G = UserGroupTable;
  const D = UserGroupDefinitionTable;
  const V = UserGroupVersionTable;

  async function audit(group: Pick<UserGroup, "id" | "name" | "kind">, action: string, metadata: Record<string, unknown> = {}) {
    await deps.recordAudit({ targetType: "user_group", targetId: group.id, action, metadata: { name: group.name, kind: group.kind, ...metadata } });
  }

  async function loadGroup(id: string, db: Executor = deps.db, lock = false): Promise<UserGroup> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new DomainError("グループの id が正しくありません", { status: 400 });
    const query = db.select().from(G).where(eq(G.id, id)).limit(1);
    const [group] = lock ? await query.for("update") : await query;
    // 例外の持ち主付きのグループは管理の口から直接は扱わない(持ち主のグループの例外の操作で扱う)
    if (!group || group.owner_group_id !== null) throw new DomainError("グループがありません", { status: 404 });
    return group;
  }

  async function definitionOf(groupId: string, db: Executor = deps.db): Promise<UserGroupDefinition | null> {
    const [row] = await db.select().from(D).where(eq(D.group_id, groupId)).limit(1);
    return row ?? null;
  }

  async function ownerGroupIds(groupId: string, db: Executor = deps.db): Promise<Set<string>> {
    const rows = await db.select({ id: G.id }).from(G).where(eq(G.owner_group_id, groupId));
    return new Set(rows.map((row) => row.id));
  }

  async function staticMemberCount(groupId: string, db: Executor = deps.db): Promise<number> {
    const [row] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(UserGroupMemberTable)
      .innerJoin(UserTable, eq(UserTable.id, UserGroupMemberTable.user_id))
      .where(and(eq(UserGroupMemberTable.group_id, groupId), isNull(UserTable.deletedAt)));
    return Number(row?.value ?? 0);
  }

  /**
   * 静的グループ(例外の持ち主付きも)の今の一員の 1 頁(利用者 id の順、消した利用者は出さない)。
   * q = 名前かメールアドレスの部分一致(D93、% _ \ は文字として探す)
   */
  async function memberPageOf(groupId: string, cursor: string | undefined, limit: number, q?: string): Promise<AdminUserGroupMemberPage> {
    const after = decodeMemberCursor(cursor);
    const M = UserGroupMemberTable;
    const pattern = q ? `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
    const rows = await deps.db
      .select({ id: M.user_id, name: UserTable.name })
      .from(M)
      .innerJoin(UserTable, eq(UserTable.id, M.user_id))
      .where(
        and(
          eq(M.group_id, groupId),
          isNull(UserTable.deletedAt),
          after ? gt(M.user_id, after) : undefined,
          pattern ? or(ilike(UserTable.name, pattern), ilike(UserTable.email, pattern)) : undefined,
        ),
      )
      .orderBy(asc(M.user_id))
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    return {
      items: page.map((row) => ({ id: row.id, name: row.name ?? null })),
      nextCursor: rows.length > limit ? encodeMemberCursor(page[page.length - 1]!.id) : null,
    };
  }

  /** 人の対象とグループの種類が合うか(一員 = 固定グループ / 例外 = 動的・定期計算) */
  function assertPeopleTarget(group: UserGroup, target: PeopleTarget): void {
    if (target === "members") assertStatic(group);
    else if (group.kind === "static") {
      throw new DomainError("固定グループには例外を設定できません(メンバーを直接追加・削除してください)", { status: 409 });
    }
  }

  /** 探す時の対象の静的グループと例外の反対側(例外がまだ無ければ null = 誰も入っていない) */
  async function peopleSidesOf(
    group: UserGroup,
    target: PeopleTarget,
  ): Promise<{ targetId: string | null; otherId: string | null; otherSide: "include" | "exclude" | null }> {
    assertPeopleTarget(group, target);
    if (target === "members") return { targetId: group.id, otherId: null, otherSide: null };
    const definition = await definitionOf(group.id);
    const exceptions = definition ? unwrapExceptions(definition.tree, await ownerGroupIds(group.id)).exceptions : null;
    const otherSide = target === "include" ? "exclude" : "include";
    if (!exceptions) return { targetId: null, otherId: null, otherSide };
    return target === "include"
      ? { targetId: exceptions.includeId, otherId: exceptions.excludeId, otherSide }
      : { targetId: exceptions.excludeId, otherId: exceptions.includeId, otherSide };
  }

  function assertStatic(group: UserGroup): void {
    if (group.kind !== "static") throw new DomainError(`グループ「${group.name}」は固定グループではありません`, { status: 409 });
  }

  async function recomputeOf(group: UserGroup): Promise<AdminUserGroupRecompute> {
    const versions = await deps.db.select().from(V).where(eq(V.group_id, group.id)).orderBy(desc(V.version));
    const current = versions.find((v) => v.version === group.current_version) ?? null;
    const failure = versions.find((v) => v.status === "failed" && (current === null || v.version > current.version)) ?? null;
    return {
      intervalMinutes: group.recompute_interval_minutes,
      defaultIntervalMinutes: deps.config.recompute.defaultIntervalMinutes,
      lastComputedAt: iso(current?.computedAt),
      lastFailure: failure ? { at: iso(failure.computedAt), reason: failure.error } : null,
      computing: versions.some((v) => v.status === "computing"),
    };
  }

  /** 人数(動的は時間の上限つき。deadline を過ぎていれば数えない) */
  async function countOf(group: UserGroup, deadline: number | null): Promise<AdminUserGroupCount> {
    if (group.kind === "static") return { value: await staticMemberCount(group.id), state: "counted" };
    if (group.kind === "scheduled") {
      if (group.current_version === null) return { value: null, state: "none" };
      const [version] = await deps.db
        .select({ count: V.member_count })
        .from(V)
        .where(and(eq(V.group_id, group.id), eq(V.version, group.current_version)))
        .limit(1);
      return version ? { value: version.count ?? 0, state: "counted" } : { value: null, state: "none" };
    }
    if (group.status === "archived" || (deadline !== null && Date.now() >= deadline)) return { value: null, state: "not_computed" };
    try {
      return { value: (await deps.listEvaluator.count({ groupId: group.id })).count, state: "estimated" };
    } catch (error) {
      if (error instanceof DomainError && (error.status === 503 || error.status === 409)) return { value: null, state: "not_computed" };
      throw error;
    }
  }

  async function summaryOf(group: UserGroup, deadline: number | null): Promise<AdminUserGroupSummary> {
    const deleteReasons = deleteReasonsOf(await referencesOf(deps.db, group.id));
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      kind: group.kind,
      kindLabel: USER_GROUP_KIND_LABELS[group.kind],
      status: group.status,
      statusLabel: USER_GROUP_STATUS_LABELS[group.status],
      count: await countOf(group, deadline),
      recompute: group.kind === "scheduled" ? await recomputeOf(group) : null,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
      deletable: deleteReasons.length === 0,
      deleteReasons,
    };
  }

  async function detailOf(group: UserGroup): Promise<AdminUserGroupDetail> {
    const summary = await summaryOf(group, null);
    if (group.kind === "static") return { ...summary, definition: null, heavy: false, notices: [], exceptions: null };
    const definition = await definitionOf(group.id);
    const owners = await ownerGroupIds(group.id);
    const unwrapped = definition ? unwrapExceptions(definition.tree, owners) : null;
    const heavy = definition?.has_heavy ?? false;
    const notices: string[] = [];
    if (group.kind === "dynamic" && heavy) notices.push(HEAVY_NOTICE);
    if (group.kind === "scheduled") notices.push(SCHEDULED_NOTICE);
    if (group.kind === "scheduled" && group.current_version === null) notices.push(NO_VERSION_NOTICE);
    const exceptions = unwrapped?.exceptions
      ? {
          includeCount: await staticMemberCount(unwrapped.exceptions.includeId),
          excludeCount: await staticMemberCount(unwrapped.exceptions.excludeId),
        }
      : { includeCount: 0, excludeCount: 0 };
    return { ...summary, definition: unwrapped?.base ?? null, heavy, notices, exceptions };
  }

  /**
   * 保存する元の定義の検査: 部品の鍵と引数・上限(checkUserGroupDefinition)と、「静的グループの一員」が指す先
   * (使える静的グループで、例外の持ち主付きでないこと)
   */
  async function checkBase(tree: unknown, db: Executor): Promise<{ tree: UserGroupDefinitionNode; heavy: boolean }> {
    const checked = checkUserGroupDefinition(tree, { criteria: deps.criteria, limits: deps.config.definition });
    const node = tree as UserGroupDefinitionNode;
    const refs = [...staticGroupRefs(node)];
    if (refs.length > 0) {
      const rows = await db.select().from(G).where(inArray(G.id, refs));
      const usable = new Set(rows.filter((g) => g.kind === "static" && g.status === "active" && g.owner_group_id === null).map((g) => g.id));
      const bad = refs.filter((id) => !usable.has(id));
      if (bad.length > 0) {
        throw new DomainError("条件「固定グループのメンバー」で選んだグループは使えません(アーカイブ済み・削除済み・例外用のグループは選べません)", { status: 400 });
      }
    }
    return { tree: node, heavy: checked.heavy };
  }

  /** 例外で包んだ木の上限の検査(包みの分だけ節と深さが増える) */
  function checkWrapped(tree: UserGroupDefinitionNode): void {
    checkUserGroupDefinition(tree, { criteria: deps.criteria, limits: deps.config.definition });
  }

  async function saveDefinition(tx: Executor, groupId: string, tree: UserGroupDefinitionNode, heavy: boolean): Promise<void> {
    const at = deps.now();
    await tx
      .insert(D)
      .values({ group_id: groupId, tree, has_heavy: heavy, updatedAt: at })
      .onConflictDoUpdate({ target: D.group_id, set: { tree, has_heavy: heavy, updatedAt: at } });
  }

  /** 静的グループの一員の供給(選んだ利用者 / 別のグループの今の一員 / タグの今の持ち主) */
  async function supplierOf(source: StaticMemberSource, targetId: string): Promise<UserIdSupplier> {
    if (source.type === "users") return arraySupplier(source.userIds);
    if (source.type === "group") {
      if (source.groupId === targetId) throw new DomainError("同じグループのメンバーはコピーできません", { status: 400 });
      await loadGroup(source.groupId);
      const max = deps.config.evaluation.listLimitMax;
      return async (after, limit) => (await deps.evaluator.listMemberIds(source.groupId, { cursor: after, limit: Math.min(limit, max) })).userIds;
    }
    const [tag] = await deps.db.select({ id: UserTagTable.id }).from(UserTagTable).where(eq(UserTagTable.id, source.tagId)).limit(1);
    if (!tag) throw new DomainError("タグがありません", { status: 404 });
    return async (after, limit) => {
      const rows = await deps.db
        .select({ id: UserTable.id })
        .from(UserToUserTagTable)
        .innerJoin(UserTable, eq(UserTable.id, UserToUserTagTable.userId))
        .where(and(eq(UserToUserTagTable.userTagId, source.tagId), isNull(UserTable.deletedAt), after ? gt(UserTable.id, after) : undefined))
        .orderBy(asc(UserTable.id))
        .limit(limit);
      return rows.map((row) => row.id);
    };
  }

  /** 静的グループを供給の一員で置き換える(1 回の要求の予算。終わらなければ incomplete、同じ元でもう一度呼ぶと続き) */
  async function replaceFrom(group: UserGroup, source: StaticMemberSource) {
    if (source.type === "users" && source.userIds.length > deps.config.memberLimit) {
      throw new DomainError(`選択した人数(${source.userIds.length} 人)が上限 ${deps.config.memberLimit} 人を超えています`, { status: 409 });
    }
    const supplier = await supplierOf(source, group.id);
    const result = await deps.writer.replaceMembers(group.id, supplier, { deadline: createDeadline(deps.config.admin.freezeBudgetMs) });
    if (result.status === "replaced") {
      await audit(group, "user_group.members.replaced", {
        from: source.type,
        memberCount: result.memberCount,
        added: result.added,
        removed: result.removed,
      });
    }
    return result;
  }

  /** 作る時の例外の人を持ち主付きの静的グループへ書く(居る・削除されていない利用者だけ。人数の上限は 409)。tx の中で */
  async function insertExceptionMembers(tx: Executor, group: UserGroup, targetId: string, userIds: readonly string[]): Promise<number> {
    if (userIds.length > deps.config.memberLimit) {
      throw new DomainError(`グループ「${group.name}」の例外の人数 ${userIds.length} が上限 ${deps.config.memberLimit} を超えています`, { status: 409 });
    }
    const size = Math.max(1, deps.config.write.batchSize);
    let written = 0;
    for (let start = 0; start < userIds.length; start += size) {
      const present = await tx
        .select({ id: UserTable.id })
        .from(UserTable)
        .where(and(inArray(UserTable.id, userIds.slice(start, start + size)), isNull(UserTable.deletedAt)));
      if (present.length === 0) continue;
      await tx
        .insert(UserGroupMemberTable)
        .values(present.map((row) => ({ group_id: targetId, user_id: row.id })))
        .onConflictDoNothing();
      written += present.length;
    }
    return written;
  }

  /** 例外のグループ(無ければ 2 つ作って定義を包む)。tx の中で */
  async function ensureExceptionGroups(tx: Executor, group: UserGroup): Promise<ExceptionGroupIds> {
    const definition = await definitionOf(group.id, tx);
    if (!definition) throw new DomainError(`グループ「${group.name}」の条件が正しくありません: 条件が設定されていません`, { status: 409 });
    const owners = await ownerGroupIds(group.id, tx);
    const unwrapped = unwrapExceptions(definition.tree, owners);
    if (unwrapped.exceptions) return unwrapped.exceptions;
    const [include] = await tx
      .insert(G)
      .values({ name: `${group.name} の足す人`, kind: "static", owner_group_id: group.id })
      .returning({ id: G.id });
    const [exclude] = await tx
      .insert(G)
      .values({ name: `${group.name} の外す人`, kind: "static", owner_group_id: group.id })
      .returning({ id: G.id });
    const ids = { includeId: include!.id, excludeId: exclude!.id };
    const wrapped = wrapWithExceptions(unwrapped.base, ids);
    checkWrapped(wrapped);
    await saveDefinition(tx, group.id, wrapped, definition.has_heavy);
    return ids;
  }

  return {
    /** 一覧(新しい順、keyset。status が無ければ使用中とアーカイブの両方、D87。例外の持ち主付きのグループは出さない) */
    async listGroups(query: unknown = {}): Promise<AdminUserGroupPage> {
      await assertUserGroupAdmin(deps);
      const { kind, status, cursor, limit } = parseOr400(ListUserGroupsQuerySchema, query, "一覧の条件が正しくありません");
      const after = decodeCursor(cursor);
      const rows = await deps.db
        .select()
        .from(G)
        .where(
          and(
            isNull(G.owner_group_id),
            status ? eq(G.status, status) : undefined,
            kind ? eq(G.kind, kind) : undefined,
            after ? or(lt(G.createdAt, after.createdAt), and(eq(G.createdAt, after.createdAt), lt(G.id, after.id))) : undefined,
          ),
        )
        .orderBy(desc(G.createdAt), desc(G.id))
        .limit(limit + 1);
      const page = rows.slice(0, limit);
      const deadline = Date.now() + deps.config.admin.listCountBudgetMs;
      const items: AdminUserGroupSummary[] = [];
      for (const group of page) items.push(await summaryOf(group, deadline));
      return { items, nextCursor: rows.length > limit ? encodeCursor(page[page.length - 1]!) : null };
    },

    /** 1 件(元の定義・heavy・注意・例外の人数) */
    async getGroup(id: string): Promise<AdminUserGroupDetail> {
      await assertUserGroupAdmin(deps);
      return detailOf(await loadGroup(id));
    },

    /**
     * 作る。動的・定期計算は定義が要り、静的は定義を持たない(一員は静的グループの口で書く)
     * @throws DomainError(400) 入力・定義の誤り
     */
    async createGroup(input: unknown): Promise<AdminUserGroupDetail> {
      await assertUserGroupAdmin(deps);
      const parsed = parseOr400(CreateUserGroupInputSchema, input, "グループの入力が正しくありません");
      if (parsed.kind === "static" && parsed.definition !== undefined) {
        throw new DomainError("固定グループには条件を設定できません(メンバーは選んで追加します)", { status: 400 });
      }
      if (parsed.kind !== "static" && parsed.definition === undefined) throw new DomainError("条件が設定されていません", { status: 400 });
      const include = [...new Set(parsed.exceptions?.include ?? [])];
      const exclude = [...new Set(parsed.exceptions?.exclude ?? [])];
      const withExceptions = include.length > 0 || exclude.length > 0;
      if (withExceptions && parsed.kind === "static") {
        throw new DomainError("固定グループには例外を設定できません(メンバーを直接追加・削除してください)", { status: 400 });
      }
      if (include.some((userId) => exclude.includes(userId))) {
        throw new DomainError("同じユーザーを「常に含める人」と「常に除外する人」の両方に入れることはできません", { status: 400 });
      }
      const counts = { includeCount: 0, excludeCount: 0 };
      const group = await deps.db.transaction(async (tx) => {
        const checked = parsed.kind === "static" ? null : await checkBase(parsed.definition, tx);
        const [row] = await tx
          .insert(G)
          .values({
            name: parsed.name,
            description: parsed.description ?? null,
            kind: parsed.kind,
            recompute_interval_minutes: parsed.kind === "scheduled" ? (parsed.recomputeIntervalMinutes ?? null) : null,
          })
          .returning();
        if (checked) await saveDefinition(tx, row!.id, checked.tree, checked.heavy);
        if (withExceptions) {
          // 例外の人: 持ち主付きの静的グループ 2 つと包んだ定義、一員(居る利用者だけ)をグループと同じ取引で書く(途中で止めない)
          const ids = await ensureExceptionGroups(tx, row!);
          counts.includeCount = await insertExceptionMembers(tx, row!, ids.includeId, include);
          counts.excludeCount = await insertExceptionMembers(tx, row!, ids.excludeId, exclude);
        }
        return row!;
      });
      await audit(group, "user_group.group.created", withExceptions ? counts : {});
      return detailOf(group);
    },

    /**
     * 直す。種類は動的 ⇄ 定期計算だけ付け替えられる(定期計算から動的にすると版を消す)。
     * 例外のあるグループの定義を直しても例外の包みは保つ
     * @throws DomainError(400) 入力・定義 / (404) 無い / (409) しまった・静的との付け替え・静的に定義
     */
    async updateGroup(id: string, input: unknown): Promise<AdminUserGroupDetail> {
      await assertUserGroupAdmin(deps);
      const patch = parseOr400(UpdateUserGroupInputSchema, input, "グループの入力が正しくありません");
      const { group, changed } = await deps.db.transaction(async (tx) => {
        const current = await loadGroup(id, tx, true);
        if (current.status === "archived") throw new DomainError(`グループ「${current.name}」はアーカイブ済みです`, { status: 409 });
        const kind: UserGroupKind = patch.kind ?? current.kind;
        if (kind !== current.kind && (kind === "static" || current.kind === "static")) {
          throw new DomainError("「作成時に固定」と「自動で都度抽出」「定期的に更新」の間では種類を変更できません(新しいグループを作成してください)", { status: 409 });
        }
        if (kind === "static" && patch.definition !== undefined) {
          throw new DomainError("固定グループには条件を設定できません", { status: 409 });
        }
        const changed = Object.keys(patch);
        if (patch.definition !== undefined) {
          const checked = await checkBase(patch.definition, tx);
          const definition = await definitionOf(current.id, tx);
          const unwrapped = definition ? unwrapExceptions(definition.tree, await ownerGroupIds(current.id, tx)) : null;
          const tree = unwrapped?.exceptions ? wrapWithExceptions(checked.tree, unwrapped.exceptions) : checked.tree;
          if (unwrapped?.exceptions) checkWrapped(tree);
          await saveDefinition(tx, current.id, tree, checked.heavy);
        }
        if (current.kind === "scheduled" && kind === "dynamic") {
          await tx.delete(V).where(eq(V.group_id, current.id));
        }
        const [row] = await tx
          .update(G)
          .set({
            name: patch.name ?? current.name,
            description: patch.description === undefined ? current.description : patch.description,
            kind,
            current_version: kind === "scheduled" ? current.current_version : null,
            recompute_interval_minutes:
              kind !== "scheduled"
                ? null
                : patch.recomputeIntervalMinutes === undefined
                  ? current.recompute_interval_minutes
                  : patch.recomputeIntervalMinutes,
            updatedAt: deps.now(),
          })
          .where(eq(G.id, current.id))
          .returning();
        return { group: row!, changed };
      });
      await audit(group, "user_group.group.updated", { changed });
      return detailOf(group);
    },

    /** しまう(一覧の既定と選択肢に出さず、新しい宛先・条件に使えない)。しまったものはそのまま返す */
    async archiveGroup(id: string): Promise<AdminUserGroupDetail> {
      await assertUserGroupAdmin(deps);
      const group = await loadGroup(id);
      if (group.status === "archived") return detailOf(group);
      const [row] = await deps.db.update(G).set({ status: "archived", updatedAt: deps.now() }).where(eq(G.id, group.id)).returning();
      await audit(row!, "user_group.group.archived");
      return detailOf(row!);
    },

    /**
     * アーカイブしたグループを使用中に戻す(定期計算は次の cron で期限が来れば計算し直す)
     * @throws DomainError(409) アーカイブ中でない / (404) 無い
     */
    async restoreGroup(id: string): Promise<AdminUserGroupDetail> {
      await assertUserGroupAdmin(deps);
      const group = await loadGroup(id);
      if (group.status !== "archived") throw new DomainError(`グループ「${group.name}」はアーカイブされていません`, { status: 409 });
      const [row] = await deps.db.update(G).set({ status: "active", updatedAt: deps.now() }).where(eq(G.id, group.id)).returning();
      await audit(row!, "user_group.group.restored");
      return detailOf(row!);
    },

    /**
     * 削除する(D92。どの状態でも)。使っている所(削除していない送信の宛先・ほかのグループの条件)があれば 409 と理由。
     * 行を排他で持った 1 つの取引で確かめて消す(定義・版・版の一員・一員・例外の人のグループとその中身は FK cascade で消える)
     * @throws DomainError(409) 使われている / (404) 無い / (400) id の形
     */
    async deleteGroup(id: string): Promise<AdminUserGroupDeleted> {
      await assertUserGroupAdmin(deps);
      const group = await deps.db.transaction(async (tx) => {
        const row = await loadGroup(id, tx, true);
        const reasons = deleteReasonsOf(await referencesOf(tx, row.id));
        if (reasons.length > 0) {
          throw new DomainError(`グループ「${row.name}」は削除できません: ${reasons.join(" / ")}`, { status: 409, code: "group_referenced" });
        }
        await tx.delete(G).where(eq(G.id, row.id));
        return row;
      });
      await audit(group, "user_group.group.deleted");
      return { id: group.id, deleted: true };
    },

    /**
     * 見込みと試しの一覧: その場の定義 { definition } か保存したグループ { groupId }。試しは id と表示名だけ
     * @throws DomainError(400) 定義の誤り / (404) 無い / (409) しまった・版が無い / (503) 時間の上限
     */
    async estimate(input: unknown): Promise<AdminUserGroupEstimate> {
      await assertUserGroupAdmin(deps);
      const parsed = parseOr400(EstimateUserGroupInputSchema, input, "見積もりの入力が正しくありません");
      const sampleLimit = deps.config.evaluation.sampleLimit;
      let base: { count: number; memberLimit: number; overLimit: boolean; heavy: boolean; ids: string[] };
      if (!("groupId" in parsed)) {
        const evaluated = await deps.evaluator.evaluate(parsed.definition, { sampleLimit });
        base = { ...evaluated, ids: evaluated.sampleUserIds };
      } else {
        const group = await loadGroup(parsed.groupId);
        const counted = await deps.evaluator.count({ groupId: group.id });
        const page = await deps.evaluator.listMemberIds(group.id, { limit: sampleLimit });
        const heavy = group.kind === "static" ? false : ((await definitionOf(group.id))?.has_heavy ?? false);
        base = { ...counted, heavy, ids: page.userIds };
      }
      const names =
        base.ids.length === 0
          ? new Map<string, string | null>()
          : new Map(
              (await deps.db.select({ id: UserTable.id, name: UserTable.name }).from(UserTable).where(inArray(UserTable.id, base.ids))).map(
                (row) => [row.id, row.name],
              ),
            );
      return {
        count: base.count,
        memberLimit: base.memberLimit,
        overLimit: base.overLimit,
        heavy: base.heavy,
        sample: base.ids.map((userId) => ({ id: userId, name: names.get(userId) ?? null })),
      };
    },

    /**
     * 例外の人(動的・定期計算だけ): 足す人・外す人の add / remove。足す人に入れた人は外す人から外す(逆も)。
     * 初めての時は持ち主付きの静的グループを 2 つ作り定義を包む。定期計算は次の cron で計算し直す(定義の時刻を進める)
     * @throws DomainError(409) 静的・しまった・人数の上限 / (404) 無い
     */
    async updateExceptions(id: string, input: unknown): Promise<AdminUserGroupDetail> {
      await assertUserGroupAdmin(deps);
      const parsed = parseOr400(UpdateUserGroupExceptionsInputSchema, input, "例外の入力が正しくありません");
      const group = await loadGroup(id);
      if (group.status === "archived") throw new DomainError(`グループ「${group.name}」はアーカイブ済みです`, { status: 409 });
      if (group.kind === "static") {
        throw new DomainError("固定グループには例外を設定できません(メンバーを直接追加・削除してください)", { status: 409 });
      }
      const ids = await deps.db.transaction((tx) => ensureExceptionGroups(tx, group));
      const includeAdd = parsed.include?.add ?? [];
      const excludeAdd = parsed.exclude?.add ?? [];
      const counts = { includeCleared: 0, includeRemoved: 0, includeAdded: 0, excludeCleared: 0, excludeRemoved: 0, excludeAdded: 0 };
      // 全員を外す(D94): 空の置き換え(同じ予算つきの書き込み)。足す・外すより先に
      const clear = async (sideGroupId: string) => {
        const result = await deps.writer.replaceMembers(sideGroupId, [], { deadline: createDeadline(deps.config.admin.freezeBudgetMs) });
        if (result.status !== "replaced") throw new DomainError("例外の人を外しきれませんでした。もう一度お試しください", { status: 503 });
        return result.removed;
      };
      if (parsed.include?.clear) counts.includeCleared = await clear(ids.includeId);
      if (parsed.exclude?.clear) counts.excludeCleared = await clear(ids.excludeId);
      const includeRemove = [...(parsed.include?.remove ?? []), ...excludeAdd];
      const excludeRemove = [...(parsed.exclude?.remove ?? []), ...includeAdd];
      if (includeRemove.length > 0) counts.includeRemoved = (await deps.writer.removeMembers(ids.includeId, includeRemove)).removed;
      if (excludeRemove.length > 0) counts.excludeRemoved = (await deps.writer.removeMembers(ids.excludeId, excludeRemove)).removed;
      if (includeAdd.length > 0) counts.includeAdded = (await deps.writer.addMembers(ids.includeId, includeAdd)).added;
      if (excludeAdd.length > 0) counts.excludeAdded = (await deps.writer.addMembers(ids.excludeId, excludeAdd)).added;
      // 定期計算は定義の時刻が最後の版より新しいと次の cron で計算し直す(例外の人の変更も同じ扱い)
      await deps.db.update(D).set({ updatedAt: deps.now() }).where(eq(D.group_id, group.id));
      await deps.db.update(G).set({ updatedAt: deps.now() }).where(eq(G.id, group.id));
      const detail = await detailOf(group);
      await audit(group, "user_group.exceptions.updated", { ...counts, ...detail.exceptions });
      return detail;
    },

    /**
     * 静的グループを作り、元(選んだ利用者・別のグループの今の一員・タグの今の持ち主)の一員を書く(1 回の要求の予算)。
     * members.status が incomplete なら、画面が POST /api/admin/user-groups/[id]/members { mode: "replace", from } を同じ元で送り直すと続きから
     * @throws DomainError(400) 入力 / (404) 元が無い / (409) 人数の上限・元がしまった・元の定期計算に版が無い / (503) 元の時間の上限
     */
    async createStaticGroup(input: unknown): Promise<AdminStaticGroupResult> {
      await assertUserGroupAdmin(deps);
      const parsed = parseOr400(CreateStaticUserGroupInputSchema, input, "固定グループの入力が正しくありません");
      if (parsed.from.type === "group") await loadGroup(parsed.from.groupId);
      const [group] = await deps.db
        .insert(G)
        .values({ name: parsed.name, description: parsed.description ?? null, kind: "static" })
        .returning();
      await audit(group!, "user_group.group.created", { from: parsed.from.type });
      const members = await replaceFrom(group!, parsed.from);
      return { group: await detailOf(group!), members };
    },

    /**
     * 静的グループの一員: { mode: "add", userIds } で足す / { mode: "replace", from } で置き換える(続きもこれ)/
     * { mode: "remove", userIds } で外す(一員でない id は何もしない。返すのは外した後の人数だけ)
     * @throws DomainError(409) 静的でない・しまった・人数の上限 / (404) 無い
     */
    async updateStaticMembers(id: string, input: unknown): Promise<AdminStaticGroupResult | AdminStaticMembersRemoved> {
      await assertUserGroupAdmin(deps);
      const parsed = parseOr400(UpdateStaticMembersInputSchema, input, "メンバーの入力が正しくありません");
      const group = await loadGroup(id);
      assertStatic(group);
      if (parsed.mode === "replace") return { group: await detailOf(group), members: await replaceFrom(group, parsed.from) };
      if (parsed.mode === "clear") {
        // 全員を外す(D94): 空の置き換え(同じ予算つきの書き込み。下書きの版 → 1 つの取引で入れ替え)
        const members = await deps.writer.replaceMembers(group.id, [], { deadline: createDeadline(deps.config.admin.freezeBudgetMs) });
        if (members.status === "replaced") {
          await audit(group, "user_group.members.cleared", { removed: members.removed, memberCount: members.memberCount });
        }
        return { group: await detailOf(group), members };
      }
      if (parsed.mode === "remove") {
        const removed = await deps.writer.removeMembers(group.id, parsed.userIds);
        if (removed.removed > 0) {
          await audit(group, "user_group.members.removed", { removed: removed.removed, memberCount: removed.memberCount });
        }
        return { memberCount: removed.memberCount };
      }
      const added = await deps.writer.addMembers(group.id, parsed.userIds);
      if (added.added > 0) await audit(group, "user_group.members.added", { added: added.added, memberCount: added.memberCount });
      return { group: await detailOf(group), members: { status: "added", ...added } };
    },

    /**
     * 静的グループの今の一員(利用者 id の順の keyset、id と表示名だけ)。しまったグループも読める
     * @throws DomainError(409) 静的でない / (404) 無い / (400) 条件・cursor
     */
    async listStaticMembers(id: string, query: unknown = {}): Promise<AdminUserGroupMemberPage> {
      await assertUserGroupAdmin(deps);
      const { q, cursor, limit } = parseOr400(ListStaticMembersQuerySchema, query, "メンバー一覧の条件が正しくありません");
      const group = await loadGroup(id);
      assertStatic(group);
      return memberPageOf(group.id, cursor, limit, q);
    },

    /**
     * 例外の人(side = include 足す人 / exclude 外す人)の一覧(利用者 id の順の keyset、id と表示名だけ)。例外が無ければ空
     * @throws DomainError(409) 静的 / (404) 無い / (400) 条件・cursor
     */
    async listExceptionMembers(id: string, query: unknown = {}): Promise<AdminUserGroupMemberPage> {
      await assertUserGroupAdmin(deps);
      const { side, q, cursor, limit } = parseOr400(ListExceptionMembersQuerySchema, query, "例外の人の一覧の条件が正しくありません");
      const group = await loadGroup(id);
      if (group.kind === "static") {
        throw new DomainError("固定グループには例外を設定できません(メンバーを直接追加・削除してください)", { status: 409 });
      }
      const definition = await definitionOf(group.id);
      const exceptions = definition ? unwrapExceptions(definition.tree, await ownerGroupIds(group.id)).exceptions : null;
      if (!exceptions) {
        decodeMemberCursor(cursor);
        return { items: [], nextCursor: null };
      }
      return memberPageOf(side === "include" ? exceptions.includeId : exceptions.excludeId, cursor, limit, q);
    },

    /**
     * 人を探す(D101): 名前かメールアドレスの部分一致(管理の利用者の選択と同じ)、利用者 id の順の keyset。
     * 1 人ずつに対象の一覧に入っているか(inList)と例外の反対側(otherSide)を付ける。id の一覧を丸ごとは返さない
     * @throws DomainError(409) 対象とグループの種類が合わない / (404) 無い / (400) 条件・cursor
     */
    async peopleSearch(id: string, query: unknown = {}): Promise<AdminUserGroupPeoplePage> {
      await assertUserGroupAdmin(deps);
      const { target, q, cursor, limit } = parseOr400(PeopleSearchQuerySchema, query, "検索の条件が正しくありません");
      const group = await loadGroup(id);
      const after = decodeMemberCursor(cursor);
      const sides = await peopleSidesOf(group, target);
      const rows = await searchPeopleRows(deps.db, { targetGroupId: sides.targetId, otherGroupId: sides.otherId, q, after, limit });
      const page = rows.slice(0, limit);
      return {
        items: page.map((row) => ({ id: row.id, name: row.name, inList: row.inList, otherSide: row.inOther ? sides.otherSide : null })),
        nextCursor: rows.length > limit ? encodeMemberCursor(page[page.length - 1]!.id) : null,
      };
    },

    /**
     * 足し外しを 1 回で(D101、1 つの取引)。例外の片側へ足した人は反対側から外す(moved)。新しい人数を返す
     * @throws DomainError(409) 対象とグループの種類が合わない・アーカイブ済み・人数の上限 / (404) 無い / (400) 入力
     */
    async peopleApply(id: string, input: unknown): Promise<AdminUserGroupPeopleApplied> {
      await assertUserGroupAdmin(deps);
      const parsed = parseOr400(PeopleApplyInputSchema, input, "足す・外す人の入力が正しくありません");
      const group = await loadGroup(id);
      if (group.status === "archived") throw new DomainError(`グループ「${group.name}」はアーカイブ済みです`, { status: 409 });
      assertPeopleTarget(group, parsed.target);
      const result = await deps.db.transaction(async (tx) => {
        // グループの行を排他で持つ(固定グループの置き換えの入れ替え・例外の書き込みと重ならない)
        await loadGroup(group.id, tx, true);
        let targetId = group.id;
        let otherId: string | null = null;
        if (parsed.target !== "members") {
          const ids = await ensureExceptionGroups(tx, group);
          targetId = parsed.target === "include" ? ids.includeId : ids.excludeId;
          otherId = parsed.target === "include" ? ids.excludeId : ids.includeId;
        }
        const applied = await applyPeopleIn(tx, {
          groupId: targetId,
          otherGroupId: otherId,
          add: parsed.add,
          remove: parsed.remove,
          batchSize: deps.config.write.batchSize,
        });
        const count = await memberCountIn(tx, targetId);
        if (count > deps.config.memberLimit) {
          throw new DomainError(`人数 ${count} 人が上限 ${deps.config.memberLimit} 人を超えるため反映できません`, { status: 409 });
        }
        if (parsed.target !== "members") {
          // 定期計算は定義の時刻が最後の版より新しいと次の cron で計算し直す(例外の人の変更も同じ扱い)
          await tx.update(D).set({ updatedAt: deps.now() }).where(eq(D.group_id, group.id));
          await tx.update(G).set({ updatedAt: deps.now() }).where(eq(G.id, group.id));
          const other = await memberCountIn(tx, otherId!);
          const counts =
            parsed.target === "include" ? { includeCount: count, excludeCount: other } : { includeCount: other, excludeCount: count };
          return { ...applied, counts };
        }
        return { ...applied, counts: { memberCount: count } };
      });
      if (parsed.target === "members") {
        await audit(group, "user_group.members.applied", { added: result.added, removed: result.removed, ...result.counts });
      } else {
        await audit(group, "user_group.exceptions.updated", {
          side: parsed.target,
          added: result.added,
          removed: result.removed,
          moved: result.moved,
          ...result.counts,
        });
      }
      return { target: parsed.target, ...result };
    },

    /** 条件の部品の一覧と選択肢(画面は label を出し、key は定義の木の値としてだけ使う) */
    async criteriaCatalog(): Promise<AdminUserGroupCriteriaCatalog> {
      await assertUserGroupAdmin(deps);
      const limit = deps.config.admin.optionsLimit;
      const tags = await deps.db.select({ value: UserTagTable.id, label: UserTagTable.name }).from(UserTagTable).orderBy(asc(UserTagTable.name)).limit(limit);
      const staticGroups = await deps.db
        .select({ value: G.id, label: G.name })
        .from(G)
        .where(and(eq(G.kind, "static"), eq(G.status, "active"), isNull(G.owner_group_id)))
        .orderBy(asc(G.name))
        .limit(limit);
      // 選択肢を画面に任せていた欄(タグ・静的グループ)は、ここで選択肢を入れる
      const fill: Record<string, AdminUserGroupOption[]> = { tagIds: tags, groupId: staticGroups };
      return {
        criteria: Object.values(deps.criteria).map((criterion) => ({
          key: criterion.key,
          label: criterion.label,
          description: criterion.description ?? null,
          weight: criterion.weight,
          weightLabel: criterion.weight === "heavy" ? "処理が重い条件" : "通常の条件",
          fields: criterion.fields.map((field) =>
            fill[field.name] && !(field as { options?: unknown }).options ? { ...field, options: fill[field.name] } : { ...field },
          ),
          // 欄を横に並べる組(D90)。部品の欄に無い name は落とし、空になった組は出さない
          inlineGroups: (criterion.inlineGroups ?? []).flatMap((group) => {
            const names = new Set(criterion.fields.map((field) => field.name));
            const fields = group.fields.filter((name) => names.has(name));
            return fields.length > 0 ? [{ ...group, fields }] : [];
          }),
        })),
        options: { tags, staticGroups },
        kinds: (Object.keys(USER_GROUP_KIND_LABELS) as UserGroupKind[]).map((value) => ({ value, label: USER_GROUP_KIND_LABELS[value] })),
      };
    },
  };
}

export type UserGroupAdminService = ReturnType<typeof createUserGroupAdminService>;
