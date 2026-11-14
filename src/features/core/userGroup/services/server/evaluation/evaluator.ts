// src/features/core/userGroup/services/server/evaluation/evaluator.ts
// 評価の口(D99・D102・D103): count・isMember・listMemberIds・evaluate。部品(db・部品の一覧・設定・門・時刻)を受けて作る
// (--db のテストは戻す取引を db に渡す)。
// - 母集団 = 削除されていない利用者(利用できる状態かは部品「状態」か使い手が見る。連絡は user の availableUserWhere を足す)
// - 静的 = user_group_members / 定期計算 = 今の版の user_group_version_members(まだ版が無い = 409)/ 動的 = 条件の木を SQL にして引く
// - 1 人の確かめ(isMember)は heavy の部品を含む動的グループを拒む(409、定期計算にすれば使える)
// - 誤り: 門 userGroups が閉 = 404(黙って false・全員に置き換えない)、無いグループ = 404、しまった(archived)・壊れた条件 = 409、
//   その場の定義の誤り = 400、時間の上限(statement_timeout)を超えた = 503
// - 人数の上限(memberLimit)は overLimit で返す(止めるのは使う所: 送信の固定・静的グループへの書き込み)

import { and, asc, count, eq, gt, isNull, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import { UserTable } from "@/features/core/user/entities/drizzle";
import type { db as appDb, TransactionClient } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors";

import type { UserGroupConfig } from "../../../config";
import {
  UserGroupDefinitionTable,
  UserGroupMemberTable,
  UserGroupTable,
  UserGroupVersionMemberTable,
  UserGroupVersionTable,
} from "../../../entities/drizzle";
import type { UserGroup } from "../../../entities/model";
import type { UserGroupDefinitionNode } from "../../../entities/schema";
import type { UserGroupCriterion } from "../../../types/criterion";
import type { UserGroupCount, UserGroupEvaluation, UserGroupMemberPage, UserGroupTarget } from "../../../types/evaluation";
import { checkUserGroupDefinition } from "../definition/checkDefinition";
import { compileUserGroupDefinition } from "./compile";

type Executor = typeof appDb | TransactionClient;

export type UserGroupEvaluatorDeps = {
  db: Executor;
  criteria: Readonly<Record<string, UserGroupCriterion>>;
  config: UserGroupConfig;
  /** 門 userGroups が開か */
  gateEnabled: () => boolean;
  now: () => Date;
};

/** 引く元: 利用者 id の列と、users に付ける述語 */
type Source =
  | { kind: "users"; where: SQL }
  | { kind: "members"; groupId: string }
  | { kind: "version"; versionId: string };

const groupIdSchema = z.string().uuid();
const TIMEOUT_CODE = "57014";

function isTimeout(error: unknown): boolean {
  for (let current: unknown = error, depth = 0; current && depth < 5; depth += 1) {
    if ((current as { code?: unknown }).code === TIMEOUT_CODE) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export function createUserGroupEvaluator(deps: UserGroupEvaluatorDeps) {
  const notDeleted = isNull(UserTable.deletedAt);

  function assertOpen(): void {
    if (!deps.gateEnabled()) throw new DomainError("ユーザーグループの機能が閉じています", { status: 404 });
  }

  /** 時間の上限つきで読む(取引の中で SET LOCAL statement_timeout) */
  async function withTimeout<T>(run: (tx: TransactionClient) => Promise<T>): Promise<T> {
    const ms = Math.max(1, Math.floor(deps.config.evaluation.timeoutMs));
    try {
      return await deps.db.transaction(async (tx) => {
        await tx.execute(sql.raw(`set local statement_timeout = ${ms}`));
        return run(tx);
      });
    } catch (error) {
      if (isTimeout(error)) {
        throw new DomainError("人数の見込みが時間内に終わりませんでした(条件を絞るか定期計算にしてください)", { status: 503 });
      }
      throw error;
    }
  }

  async function loadGroup(groupId: string): Promise<UserGroup> {
    if (!groupIdSchema.safeParse(groupId).success) throw new DomainError("グループの id が正しくありません", { status: 400 });
    const [group] = await deps.db.select().from(UserGroupTable).where(eq(UserGroupTable.id, groupId)).limit(1);
    if (!group) throw new DomainError("グループがありません", { status: 404 });
    if (group.status === "archived") throw new DomainError(`グループ「${group.name}」はしまってあります`, { status: 409 });
    return group;
  }

  async function storedTree(group: UserGroup): Promise<{ tree: UserGroupDefinitionNode; heavy: boolean }> {
    const [row] = await deps.db
      .select()
      .from(UserGroupDefinitionTable)
      .where(eq(UserGroupDefinitionTable.group_id, group.id))
      .limit(1);
    if (!row) throw new DomainError(`グループ「${group.name}」の条件が壊れています: 定義がありません`, { status: 409 });
    return { tree: row.tree, heavy: row.has_heavy };
  }

  function inline(tree: unknown): { where: SQL; heavy: boolean } {
    const checked = checkUserGroupDefinition(tree, { criteria: deps.criteria, limits: deps.config.definition });
    const where = compileUserGroupDefinition(tree as UserGroupDefinitionNode, { criteria: deps.criteria, now: deps.now(), source: "inline" });
    return { where, heavy: checked.heavy };
  }

  async function sourceOf(group: UserGroup): Promise<Source> {
    if (group.kind === "static") return { kind: "members", groupId: group.id };
    if (group.kind === "scheduled") {
      if (group.current_version === null) {
        throw new DomainError(`グループ「${group.name}」はまだ計算し終えた版がありません`, { status: 409 });
      }
      const [version] = await deps.db
        .select({ id: UserGroupVersionTable.id })
        .from(UserGroupVersionTable)
        .where(and(eq(UserGroupVersionTable.group_id, group.id), eq(UserGroupVersionTable.version, group.current_version)))
        .limit(1);
      if (!version) throw new DomainError(`グループ「${group.name}」の今の版がありません`, { status: 409 });
      return { kind: "version", versionId: version.id };
    }
    const { tree } = await storedTree(group);
    return {
      kind: "users",
      where: compileUserGroupDefinition(tree, { criteria: deps.criteria, now: deps.now(), source: "stored" }),
    };
  }

  /** 引く元の利用者 id の select(削除されていない利用者だけ)。extra = 足す条件 */
  function selectIds(tx: TransactionClient, source: Source, extra: SQL[] = []) {
    if (source.kind === "users") {
      return tx.select({ id: UserTable.id }).from(UserTable).where(and(notDeleted, source.where, ...extra));
    }
    if (source.kind === "members") {
      return tx
        .select({ id: UserTable.id })
        .from(UserGroupMemberTable)
        .innerJoin(UserTable, eq(UserTable.id, UserGroupMemberTable.user_id))
        .where(and(eq(UserGroupMemberTable.group_id, source.groupId), notDeleted, ...extra));
    }
    return tx
      .select({ id: UserTable.id })
      .from(UserGroupVersionMemberTable)
      .innerJoin(UserTable, eq(UserTable.id, UserGroupVersionMemberTable.user_id))
      .where(and(eq(UserGroupVersionMemberTable.version_id, source.versionId), notDeleted, ...extra));
  }

  async function countOf(tx: TransactionClient, source: Source): Promise<number> {
    const ids = selectIds(tx, source).as("ids");
    const [row] = await tx.select({ value: count() }).from(ids);
    return Number(row?.value ?? 0);
  }

  const withLimit = (value: number): UserGroupCount => ({
    count: value,
    memberLimit: deps.config.memberLimit,
    overLimit: value > deps.config.memberLimit,
  });

  return {
    /**
     * 人数(保存したグループか、その場の定義)
     * @throws DomainError(404) 門が閉・無いグループ / (409) しまった・壊れた・版が無い / (400) その場の定義の誤り / (503) 時間の上限
     */
    async count(target: UserGroupTarget): Promise<UserGroupCount> {
      assertOpen();
      const source: Source =
        "definition" in target ? { kind: "users", where: inline(target.definition).where } : await sourceOf(await loadGroup(target.groupId));
      return withLimit(await withTimeout((tx) => countOf(tx, source)));
    },

    /**
     * 1 人がグループの一員か
     * @throws DomainError(409) heavy の部品を含む動的グループ(定期計算にすれば使える)ほか count と同じ
     */
    async isMember(groupId: string, userId: string): Promise<boolean> {
      assertOpen();
      const group = await loadGroup(groupId);
      if (group.kind === "dynamic" && (await storedTree(group)).heavy) {
        throw new DomainError(`グループ「${group.name}」は重い条件を含むので 1 人ずつ確かめられません(定期計算にしてください)`, { status: 409 });
      }
      if (!z.string().uuid().safeParse(userId).success) return false;
      const source = await sourceOf(group);
      const rows = await withTimeout((tx) => selectIds(tx, source, [eq(UserTable.id, userId)]).limit(1));
      return rows.length > 0;
    },

    /**
     * 一員の利用者 id(利用者 id の昇順、keyset)。limit は 1〜設定の listLimitMax
     * @throws count と同じ
     */
    async listMemberIds(groupId: string, options: { cursor?: string | null; limit?: number } = {}): Promise<UserGroupMemberPage> {
      assertOpen();
      const max = deps.config.evaluation.listLimitMax;
      const limit = Math.min(Math.max(Math.floor(options.limit ?? max), 1), max);
      const source = await sourceOf(await loadGroup(groupId));
      const extra = options.cursor ? [gt(UserTable.id, options.cursor)] : [];
      const rows = await withTimeout((tx) => selectIds(tx, source, extra).orderBy(asc(UserTable.id)).limit(limit));
      const userIds = rows.map((row) => row.id);
      return { userIds, nextCursor: userIds.length === limit ? userIds[userIds.length - 1]! : null };
    },

    /**
     * 保存しないその場の定義の人数と試しの一覧
     * @throws DomainError(400) 定義の誤り / (404) 門が閉 / (503) 時間の上限
     */
    async evaluate(definition: unknown, options: { sampleLimit?: number } = {}): Promise<UserGroupEvaluation> {
      assertOpen();
      const { where, heavy } = inline(definition);
      const source: Source = { kind: "users", where };
      const sampleLimit = Math.min(Math.max(Math.floor(options.sampleLimit ?? deps.config.evaluation.sampleLimit), 0), deps.config.evaluation.listLimitMax);
      const { total, sample } = await withTimeout(async (tx) => ({
        total: await countOf(tx, source),
        sample: sampleLimit > 0 ? await selectIds(tx, source).orderBy(asc(UserTable.id)).limit(sampleLimit) : [],
      }));
      return { ...withLimit(total), sampleUserIds: sample.map((row) => row.id), heavy };
    },
  };
}

export type UserGroupEvaluator = ReturnType<typeof createUserGroupEvaluator>;
