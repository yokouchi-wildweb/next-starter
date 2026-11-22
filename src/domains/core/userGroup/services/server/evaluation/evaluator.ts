// src/domains/core/userGroup/services/server/evaluation/evaluator.ts
// 評価の口(D99・D102・D103): count・isMember・listMemberIds・evaluate と、連絡の送信の固定の口 sendTarget・memberWhere(D58)。部品(db・部品の一覧・設定・門・時刻)を受けて作る
// (--db のテストは戻す取引を db に渡す)。
// - 母集団 = 削除されていない利用者(利用できる状態かは部品「状態」か使い手が見る。連絡は user の availableUserWhere を足す)
// - 静的 = user_group_members / 定期計算 = 今の版の user_group_version_members(まだ版が無い = 409)/ 動的 = 条件の木を SQL にして引く
// - 1 人の確かめ(isMember)は heavy の部品を含む動的グループを拒む(409、定期計算にすれば使える)
// - 誤り: 門 userGroups が閉 = 404(黙って false・全員に置き換えない)、無いグループ = 404、しまった(archived)・壊れた条件 = 409、
//   その場の定義の誤り = 400、時間の上限(statement_timeout)を超えた = 503
// - 人数の上限(memberLimit)は overLimit で返す(止めるのは使う所: 送信の固定・静的グループへの書き込み)
// - 送信の固定(D58): 送り始めに sendTarget で確かめて定期計算の版を決め、固定の時に memberWhere が users に付ける述語を返す。
//   使い手(連絡)はそれを 1 文の INSERT … SELECT に埋め、1 つの時点の一員を書く(時間の上限 timeoutMs も使い手が SET LOCAL で掛ける)

import { and, asc, count, eq, gt, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import { UserTable } from "@/domains/core/user/entities/drizzle";
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

/** 送り始めの確かめ(人数と上限、定期計算は固定する版の番号。他は null) */
export type UserGroupSendTarget = UserGroupCount & { version: number | null };

/** 固定の時の一員の述語(users に付ける。削除されていない利用者だけ)と、その 1 文に掛ける時間の上限 */
export type UserGroupMemberWhere = { where: SQL; count: number; timeoutMs: number };

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
        throw new DomainError("対象人数の見積もりが時間内に終わりませんでした(条件を絞り込むか、「定期的に更新」にしてください)", { status: 503 });
      }
      throw error;
    }
  }

  async function loadGroup(groupId: string): Promise<UserGroup> {
    if (!groupIdSchema.safeParse(groupId).success) throw new DomainError("グループの id が正しくありません", { status: 400 });
    const [group] = await deps.db.select().from(UserGroupTable).where(eq(UserGroupTable.id, groupId)).limit(1);
    if (!group) throw new DomainError("グループがありません", { status: 404 });
    if (group.status === "archived") throw new DomainError(`グループ「${group.name}」はアーカイブ済みです`, { status: 409 });
    return group;
  }

  async function storedTree(group: UserGroup): Promise<{ tree: UserGroupDefinitionNode; heavy: boolean }> {
    const [row] = await deps.db
      .select()
      .from(UserGroupDefinitionTable)
      .where(eq(UserGroupDefinitionTable.group_id, group.id))
      .limit(1);
    if (!row) throw new DomainError(`グループ「${group.name}」の条件が正しくありません: 条件が設定されていません`, { status: 409 });
    return { tree: row.tree, heavy: row.has_heavy };
  }

  function inline(tree: unknown): { where: SQL; heavy: boolean } {
    const checked = checkUserGroupDefinition(tree, { criteria: deps.criteria, limits: deps.config.definition });
    const where = compileUserGroupDefinition(tree as UserGroupDefinitionNode, { criteria: deps.criteria, now: deps.now(), source: "inline" });
    return { where, heavy: checked.heavy };
  }

  /** pinnedVersion = 定期計算の決めた版(送り始めに固定した版。省略 = 今の版) */
  async function sourceOf(group: UserGroup, pinnedVersion?: number | null): Promise<Source> {
    if (group.kind === "static") return { kind: "members", groupId: group.id };
    if (group.kind === "scheduled") {
      const number = pinnedVersion ?? group.current_version;
      if (number === null) {
        throw new DomainError(`グループ「${group.name}」はまだ集計されていません`, { status: 409 });
      }
      const [version] = await deps.db
        .select({ id: UserGroupVersionTable.id })
        .from(UserGroupVersionTable)
        .where(and(eq(UserGroupVersionTable.group_id, group.id), eq(UserGroupVersionTable.version, number)))
        .limit(1);
      if (!version) {
        const which = pinnedVersion == null ? "集計結果" : `配信開始時に固定した集計結果(${number})`;
        throw new DomainError(`グループ「${group.name}」の${which}がありません`, { status: 409 });
      }
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

  /** 引く元を users に付ける述語にする(固定の 1 文が users から引くため) */
  function whereOf(source: Source): SQL {
    if (source.kind === "users") return and(notDeleted, source.where)!;
    const ids =
      source.kind === "members"
        ? deps.db.select({ id: UserGroupMemberTable.user_id }).from(UserGroupMemberTable).where(eq(UserGroupMemberTable.group_id, source.groupId))
        : deps.db
            .select({ id: UserGroupVersionMemberTable.user_id })
            .from(UserGroupVersionMemberTable)
            .where(eq(UserGroupVersionMemberTable.version_id, source.versionId));
    return and(notDeleted, inArray(UserTable.id, ids))!;
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
        throw new DomainError(`グループ「${group.name}」は処理が重い条件を含むため、1 人ずつの判定に使えません(「定期的に更新」にしてください)`, { status: 409 });
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
     * 連絡の送り始めの確かめ: 人数と上限と、定期計算なら固定する版(今の版)。上限を超えても投げない(使い手が止める)
     * @throws count と同じ
     */
    async sendTarget(groupId: string): Promise<UserGroupSendTarget> {
      assertOpen();
      const group = await loadGroup(groupId);
      const source = await sourceOf(group);
      const counted = withLimit(await withTimeout((tx) => countOf(tx, source)));
      return { ...counted, version: group.kind === "scheduled" ? group.current_version : null };
    },

    /**
     * 連絡の送信の固定の時の一員の述語(users に付ける)。門・しまった・壊れた・版・人数の上限を先に確かめる。
     * version = sendTarget が返した版(定期計算。その版が消えていれば 409)
     * @throws DomainError(409) 人数の上限を超えた・送り始めの版が無い ほか count と同じ
     */
    async memberWhere(groupId: string, options: { version?: number | null } = {}): Promise<UserGroupMemberWhere> {
      assertOpen();
      const group = await loadGroup(groupId);
      const source = await sourceOf(group, group.kind === "scheduled" ? options.version : null);
      const counted = withLimit(await withTimeout((tx) => countOf(tx, source)));
      if (counted.overLimit) {
        throw new DomainError(`グループ「${group.name}」の人数 ${counted.count} が上限 ${counted.memberLimit} を超えています`, { status: 409 });
      }
      return { where: whereOf(source), count: counted.count, timeoutMs: Math.max(1, Math.floor(deps.config.evaluation.timeoutMs)) };
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
