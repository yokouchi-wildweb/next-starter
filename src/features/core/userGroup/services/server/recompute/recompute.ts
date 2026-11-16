// src/features/core/userGroup/services/server/recompute/recompute.ts
// 定期計算(D103、cron user-group-recompute の本体)。部品(db・部品の一覧・設定・時刻)を受けて作る(--db のテストは戻す取引を渡す)。
// - 期限: 使える(active)定期計算のグループのうち、書きかけの版がある(続きを書く)か、最後の版の計算の開始から
//   間隔(user_groups.recompute_interval_minutes、null = 設定の recompute.defaultIntervalMinutes)が過ぎたもの。版が無ければすぐ。
//   条件の定義(例外の人の変更を含む)を最後の版の計算の開始より後に直したグループもすぐ(書きかけの版は捨てて新しい版から)
// - 計算: 保存した条件の木を SQL にして(heavy の部品も使える)、削除されていない利用者を id の昇順に束ごとに版へ書く。
//   条件の時刻の基準は版の計算の開始(started_at)= 何回に分けて書いても 1 つの時点の一員になる。
//   締切で止まったら次の回に版の resume_after から続ける
// - 切り替え: 書き終えたら 1 つの取引で版を ready(computed_at・member_count)にし、user_groups.current_version を切り替え、
//   今の版と 1 つ前の版を残して他の版を消す。読む側は切り替えの commit まで前の版を読む
// - 失敗: 条件が壊れた・人数の上限を超えた・書く途中の誤り = 版を failed(理由を error に)、今の版はそのまま。
//   失敗の版は一番新しい 1 つだけ残す(理由を管理画面で見せる)。次の期限でもう一度計算する
// - 生の SQL に JS の Date を入れない(時刻の比べは JS か Drizzle の演算子)

import { and, asc, desc, eq, gt, isNull, ne, notInArray } from "drizzle-orm";

import { UserTable } from "@/features/core/user/entities/drizzle";
import { DomainError } from "@/lib/errors";

import type { UserGroupConfig } from "../../../config";
import { UserGroupDefinitionTable, UserGroupTable, UserGroupVersionTable } from "../../../entities/drizzle";
import type { UserGroup, UserGroupVersion } from "../../../entities/model";
import type { UserGroupCriterion } from "../../../types/criterion";
import { compileUserGroupDefinition } from "../evaluation/compile";
import { createComputingVersion, writeVersionUntil, type Executor, type UserIdSupplier } from "../writes/versionWriter";

export type UserGroupRecomputeDeps = {
  db: Executor;
  criteria: Readonly<Record<string, UserGroupCriterion>>;
  config: UserGroupConfig;
  now: () => Date;
};

export type UserGroupRecomputeResult = {
  /** 見た定期計算のグループの数 */
  checked: number;
  /** 期限が来ていた(書きかけを含む)数 */
  due: number;
  /** 今の版を切り替えた数 */
  switched: number;
  /** 失敗にした数 */
  failed: number;
  /** 書きかけで止めた数(次の回に続き) */
  incomplete: number;
  /** 締切で残りのグループに手を付けなかった */
  budgetExhausted: boolean;
};

const MINUTE = 60_000;

/** グループの期限が来ているか(書きかけの版があれば常に来ている) */
export function isRecomputeDue(
  group: Pick<UserGroup, "recompute_interval_minutes">,
  latest: Pick<UserGroupVersion, "status" | "startedAt"> | null,
  now: Date,
  defaultIntervalMinutes: number,
  /** 条件の定義を最後に直した時刻(例外の人の変更を含む)。最後の版の開始より後なら期限が来ている */
  definitionUpdatedAt: Date | null = null,
): boolean {
  if (!latest) return true;
  if (latest.status === "computing") return true;
  if (definitionUpdatedAt && definitionUpdatedAt.getTime() > latest.startedAt.getTime()) return true;
  const minutes = group.recompute_interval_minutes ?? defaultIntervalMinutes;
  return latest.startedAt.getTime() + Math.max(0, minutes) * MINUTE <= now.getTime();
}

function errorText(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.slice(0, 1000);
}

export function createUserGroupRecompute(deps: UserGroupRecomputeDeps) {
  const V = UserGroupVersionTable;

  async function latestVersion(groupId: string): Promise<UserGroupVersion | null> {
    const [row] = await deps.db.select().from(V).where(eq(V.group_id, groupId)).orderBy(desc(V.version)).limit(1);
    return row ?? null;
  }

  async function definitionUpdatedAtOf(groupId: string): Promise<Date | null> {
    const [row] = await deps.db
      .select({ updatedAt: UserGroupDefinitionTable.updatedAt })
      .from(UserGroupDefinitionTable)
      .where(eq(UserGroupDefinitionTable.group_id, groupId))
      .limit(1);
    return row?.updatedAt ?? null;
  }

  /** 版を failed にし、他の失敗の版を消す(今の版と 1 つ前は残る: ready の版は消さない) */
  async function fail(version: UserGroupVersion, reason: string): Promise<void> {
    await deps.db.transaction(async (tx) => {
      await tx
        .update(V)
        .set({ status: "failed", error: reason, computedAt: deps.now(), resume_after: null })
        .where(eq(V.id, version.id));
      await tx.delete(V).where(and(eq(V.group_id, version.group_id), eq(V.status, "failed"), ne(V.id, version.id)));
    });
  }

  /** 書き終えた版を今の版にする(1 つの取引)。今の版と 1 つ前を残して他の版を消す */
  async function switchTo(group: UserGroup, version: UserGroupVersion, memberCount: number): Promise<void> {
    await deps.db.transaction(async (tx) => {
      const [locked] = await tx.select().from(UserGroupTable).where(eq(UserGroupTable.id, group.id)).for("update");
      const previous = locked?.current_version ?? null;
      const at = deps.now();
      await tx
        .update(V)
        .set({ status: "ready", computedAt: at, member_count: memberCount, error: null, resume_after: null })
        .where(eq(V.id, version.id));
      await tx.update(UserGroupTable).set({ current_version: version.version, updatedAt: at }).where(eq(UserGroupTable.id, group.id));
      const keep = previous === null ? [version.version] : [version.version, previous];
      await tx.delete(V).where(and(eq(V.group_id, group.id), notInArray(V.version, keep)));
    });
  }

  /** 保存した条件の木の利用者 id の供給(版の計算の開始を条件の時刻の基準にする) */
  async function supplierOf(group: UserGroup, version: UserGroupVersion): Promise<UserIdSupplier> {
    const [definition] = await deps.db
      .select()
      .from(UserGroupDefinitionTable)
      .where(eq(UserGroupDefinitionTable.group_id, group.id))
      .limit(1);
    if (!definition) throw new DomainError(`グループ「${group.name}」の条件が正しくありません: 条件が設定されていません`, { status: 409 });
    const where = compileUserGroupDefinition(definition.tree, { criteria: deps.criteria, now: version.startedAt, source: "stored" });
    return async (after, limit) => {
      const rows = await deps.db
        .select({ id: UserTable.id })
        .from(UserTable)
        .where(and(isNull(UserTable.deletedAt), where, after ? gt(UserTable.id, after) : undefined))
        .orderBy(asc(UserTable.id))
        .limit(limit);
      return rows.map((row) => row.id);
    };
  }

  return {
    /**
     * 期限の来た定期計算のグループを締切まで計算する
     * @param options.maxChunks 1 つのグループで書く束の数の上限(テスト)
     */
    async run(options: { deadline: Date; maxChunks?: number }): Promise<UserGroupRecomputeResult> {
      const result: UserGroupRecomputeResult = { checked: 0, due: 0, switched: 0, failed: 0, incomplete: 0, budgetExhausted: false };
      const groups = await deps.db
        .select()
        .from(UserGroupTable)
        .where(and(eq(UserGroupTable.kind, "scheduled"), eq(UserGroupTable.status, "active")))
        .orderBy(asc(UserGroupTable.id));
      result.checked = groups.length;
      const now = deps.now();
      const due: { group: UserGroup; latest: UserGroupVersion | null; definitionUpdatedAt: Date | null }[] = [];
      for (const group of groups) {
        const latest = await latestVersion(group.id);
        const definitionUpdatedAt = await definitionUpdatedAtOf(group.id);
        if (isRecomputeDue(group, latest, now, deps.config.recompute.defaultIntervalMinutes, definitionUpdatedAt)) {
          due.push({ group, latest, definitionUpdatedAt });
        }
      }
      result.due = due.length;

      for (const { group, latest, definitionUpdatedAt } of due) {
        if (Date.now() >= options.deadline.getTime()) {
          result.budgetExhausted = true;
          break;
        }
        // 書きかけの版の後に定義を直していれば、その版は古い条件なので捨てて新しい版から書く
        const stale = latest?.status === "computing" && definitionUpdatedAt !== null && definitionUpdatedAt > latest.startedAt;
        if (stale) await deps.db.delete(V).where(eq(V.id, latest.id));
        const version = latest?.status === "computing" && !stale ? latest : await createComputingVersion(deps.db, group.id);
        try {
          const supplier = await supplierOf(group, version);
          const written = await writeVersionUntil(deps.db, version.id, supplier, {
            batchSize: deps.config.recompute.batchSize,
            memberLimit: deps.config.memberLimit,
            deadline: options.deadline,
            maxChunks: options.maxChunks,
          });
          if (written.outcome === "done") {
            await switchTo(group, version, written.memberCount);
            result.switched += 1;
          } else if (written.outcome === "over_limit") {
            await fail(version, `人数が上限 ${deps.config.memberLimit} を超えました(${written.memberCount} 人まで数えて止めました)。条件を絞るか、設定の memberLimit を見直してください`);
            result.failed += 1;
          } else {
            result.incomplete += 1;
          }
        } catch (error) {
          await fail(version, errorText(error));
          result.failed += 1;
        }
      }
      return result;
    },
  };
}

export type UserGroupRecompute = ReturnType<typeof createUserGroupRecompute>;
