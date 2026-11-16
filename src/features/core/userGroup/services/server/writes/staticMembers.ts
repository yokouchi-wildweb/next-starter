// src/features/core/userGroup/services/server/writes/staticMembers.ts
// 静的グループへ書く口(D102・D103): replaceMembers・addMembers・removeMembers。部品(db・設定・門・締切)を受けて作る
// (--db のテストは戻す取引を db に渡す)。fork の task / cron が SQL で書けない条件で選んだ利用者を書く口でもある。
// - 置き換え: 新しい一員を静的グループの computing の版(下書き、user_group_versions + user_group_version_members)へ
//   利用者 id の昇順に束ごとに書き(締切で止まれば次の呼び出しが resume_after から続ける)、書き終えたら 1 つの取引で
//   user_group_members と入れ替えて下書きを消す。読む側は user_group_members だけを読むので、入れ替えの commit まで前の一員を見る
// - 足す・外す: 1 つの取引(グループの行を FOR UPDATE で取り、入れ替えと重ならない)。無い・削除された利用者は飛ばして数える
// - 人数の上限(memberLimit)を超えるなら書かずに 409(理由つき。置き換えは下書きを消す)。黙って途中で切らない
// - 誤り: 門 userGroups が閉 = 404、id の形 = 400、無いグループ = 404、しまった・静的でない = 409
// - 監査の行は書かない: 管理者の操作は管理の API(指令 48)が記録し、fork の system の task はここで書かない

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { UserTable } from "@/features/core/user/entities/drizzle";
import { createDeadline } from "@/lib/cron";
import { DomainError } from "@/lib/errors";

import type { UserGroupConfig } from "../../../config";
import {
  UserGroupMemberTable,
  UserGroupTable,
  UserGroupVersionMemberTable,
  UserGroupVersionTable,
} from "../../../entities/drizzle";
import type { UserGroup } from "../../../entities/model";
import {
  arraySupplier,
  countOfExecute,
  createComputingVersion,
  findComputingVersion,
  writeVersionUntil,
  type Executor,
  type UserIdSupplier,
} from "./versionWriter";

export type StaticMemberWriterDeps = {
  db: Executor;
  config: UserGroupConfig;
  /** 門 userGroups が開か */
  gateEnabled: () => boolean;
};

export type ReplaceMembersOptions = {
  /** 締切(既定 = 今 + 設定の recompute.budgetMs) */
  deadline?: Date;
  /** 1 回の呼び出しで書く束の数の上限(テスト・小分けの呼び出し) */
  maxChunks?: number;
  /** 書きかけの下書きを捨てて最初から書く(既定 false = 続きから) */
  restart?: boolean;
};

export type ReplaceMembersResult =
  | {
      /** 入れ替えた */
      status: "replaced";
      memberCount: number;
      added: number;
      removed: number;
      /** 供給されたが入らなかった id(無い・削除された利用者、重複) */
      skipped: number;
    }
  | {
      /** 下書きを書きかけで止めた(前の一員のまま)。同じ供給でもう一度呼ぶと続きから */
      status: "incomplete";
      /** 下書きに書いた人数 */
      staged: number;
      skipped: number;
    };

export type AddMembersResult = { added: number; skipped: number; memberCount: number };
export type RemoveMembersResult = { removed: number; memberCount: number };

const groupIdSchema = z.string().uuid();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function limitError(group: UserGroup, count: number, limit: number): DomainError {
  return new DomainError(
    `グループ「${group.name}」の人数が上限 ${limit} を超えます(${count} 人)。条件を絞るか、設定の memberLimit を見直してください`,
    { status: 409 },
  );
}

export function createStaticMemberWriter(deps: StaticMemberWriterDeps) {
  function assertOpen(): void {
    if (!deps.gateEnabled()) throw new DomainError("ユーザーグループの機能が閉じています", { status: 404 });
  }

  /** 書ける静的グループ(lock = 取引の中で行を FOR UPDATE で取る) */
  async function loadStatic(db: Executor, groupId: string, lock = false): Promise<UserGroup> {
    if (!groupIdSchema.safeParse(groupId).success) throw new DomainError("グループの id が正しくありません", { status: 400 });
    const query = db.select().from(UserGroupTable).where(eq(UserGroupTable.id, groupId)).limit(1);
    const [group] = lock ? await query.for("update") : await query;
    if (!group) throw new DomainError("グループがありません", { status: 404 });
    if (group.status === "archived") throw new DomainError(`グループ「${group.name}」はアーカイブ済みです`, { status: 409 });
    if (group.kind !== "static") {
      throw new DomainError(`グループ「${group.name}」は固定グループではないため、メンバーを登録できません`, { status: 409 });
    }
    return group;
  }

  async function memberCountOf(db: Executor, groupId: string): Promise<number> {
    const [row] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(UserGroupMemberTable)
      .where(eq(UserGroupMemberTable.group_id, groupId));
    return Number(row?.value ?? 0);
  }

  /** 利用者 id の配列(形の誤りは落とす)を、束の大きさごとに */
  function chunksOf(userIds: readonly string[]): string[][] {
    const unique = [...new Set(userIds.map((id) => id.toLowerCase()).filter((id) => UUID.test(id)))].sort();
    const size = Math.max(1, Math.floor(deps.config.write.batchSize));
    const out: string[][] = [];
    for (let i = 0; i < unique.length; i += size) out.push(unique.slice(i, i + size));
    return out;
  }

  return {
    /**
     * 静的グループの一員を供給の利用者で置き換える(予算つき、書き終えるまで前の一員のまま)。
     * source = 利用者 id の配列か、keyset の供給(after より大きい id を昇順で返す)
     * @throws DomainError(404) 門が閉・無いグループ / (400) id の形 / (409) しまった・静的でない・人数の上限
     */
    async replaceMembers(
      groupId: string,
      source: readonly string[] | UserIdSupplier,
      options: ReplaceMembersOptions = {},
    ): Promise<ReplaceMembersResult> {
      assertOpen();
      const group = await loadStatic(deps.db, groupId);
      const supplier = typeof source === "function" ? source : arraySupplier(source);
      let stage = await findComputingVersion(deps.db, group.id);
      if (stage && options.restart) {
        await deps.db.delete(UserGroupVersionTable).where(eq(UserGroupVersionTable.id, stage.id));
        stage = null;
      }
      stage ??= await createComputingVersion(deps.db, group.id);
      const written = await writeVersionUntil(deps.db, stage.id, supplier, {
        batchSize: deps.config.write.batchSize,
        memberLimit: deps.config.memberLimit,
        deadline: options.deadline ?? createDeadline(deps.config.recompute.budgetMs),
        maxChunks: options.maxChunks,
      });
      if (written.outcome === "over_limit") {
        await deps.db.delete(UserGroupVersionTable).where(eq(UserGroupVersionTable.id, stage.id));
        throw limitError(group, written.memberCount, deps.config.memberLimit);
      }
      if (written.outcome !== "done") return { status: "incomplete", staged: written.memberCount, skipped: written.skipped };

      const stageId = stage.id;
      return deps.db.transaction(async (tx) => {
        await loadStatic(tx, group.id, true);
        const M = UserGroupMemberTable;
        const VM = UserGroupVersionMemberTable;
        // 下書きに無い一員を外し、下書きの一員を足す(id は uuid の文字列だけ。生の SQL に Date は入れない)
        const removed = await countOfExecute(
          tx,
          sql`with gone as (
            delete from ${M} m
            where m.group_id = ${group.id}::uuid
              and not exists (select 1 from ${VM} vm where vm.version_id = ${stageId}::uuid and vm.user_id = m.user_id)
            returning 1
          ) select count(*)::int as n from gone`,
        );
        const added = await countOfExecute(
          tx,
          sql`with ins as (
            insert into ${M} (group_id, user_id)
            select ${group.id}::uuid, vm.user_id from ${VM} vm where vm.version_id = ${stageId}::uuid
            on conflict do nothing
            returning 1
          ) select count(*)::int as n from ins`,
        );
        await tx.delete(UserGroupVersionTable).where(eq(UserGroupVersionTable.id, stageId));
        await tx.update(UserGroupTable).set({ updatedAt: new Date() }).where(eq(UserGroupTable.id, group.id));
        return { status: "replaced", memberCount: await memberCountOf(tx, group.id), added, removed, skipped: written.skipped };
      });
    },

    /**
     * 静的グループに利用者を足す(もう入っている・無い・削除された利用者は飛ばす)
     * @throws replaceMembers と同じ(人数の上限は足した後の人数で見る)
     */
    async addMembers(groupId: string, userIds: readonly string[]): Promise<AddMembersResult> {
      assertOpen();
      const chunks = chunksOf(userIds);
      return deps.db.transaction(async (tx) => {
        const group = await loadStatic(tx, groupId, true);
        const current = await memberCountOf(tx, group.id);
        const fresh: string[] = [];
        for (const chunk of chunks) {
          const rows = await tx
            .select({ id: UserTable.id })
            .from(UserTable)
            .where(
              and(
                inArray(UserTable.id, chunk),
                isNull(UserTable.deletedAt),
                sql`not exists (select 1 from ${UserGroupMemberTable} m where m.group_id = ${group.id}::uuid and m.user_id = ${UserTable.id})`,
              ),
            )
            .orderBy(asc(UserTable.id));
          fresh.push(...rows.map((row) => row.id));
        }
        if (current + fresh.length > deps.config.memberLimit) throw limitError(group, current + fresh.length, deps.config.memberLimit);
        const size = Math.max(1, Math.floor(deps.config.write.batchSize));
        let added = 0;
        for (let i = 0; i < fresh.length; i += size) {
          const inserted = await tx
            .insert(UserGroupMemberTable)
            .values(fresh.slice(i, i + size).map((userId) => ({ group_id: group.id, user_id: userId })))
            .onConflictDoNothing()
            .returning({ id: UserGroupMemberTable.user_id });
          added += inserted.length;
        }
        if (added > 0) await tx.update(UserGroupTable).set({ updatedAt: new Date() }).where(eq(UserGroupTable.id, group.id));
        return { added, skipped: userIds.length - added, memberCount: current + added };
      });
    },

    /**
     * 静的グループから利用者を外す(一員でない id は何もしない)
     * @throws DomainError(404) 門が閉・無いグループ / (400) id の形 / (409) しまった・静的でない
     */
    async removeMembers(groupId: string, userIds: readonly string[]): Promise<RemoveMembersResult> {
      assertOpen();
      const chunks = chunksOf(userIds);
      return deps.db.transaction(async (tx) => {
        const group = await loadStatic(tx, groupId, true);
        let removed = 0;
        for (const chunk of chunks) {
          const rows = await tx
            .delete(UserGroupMemberTable)
            .where(and(eq(UserGroupMemberTable.group_id, group.id), inArray(UserGroupMemberTable.user_id, chunk)))
            .returning({ id: UserGroupMemberTable.user_id });
          removed += rows.length;
        }
        if (removed > 0) await tx.update(UserGroupTable).set({ updatedAt: new Date() }).where(eq(UserGroupTable.id, group.id));
        return { removed, memberCount: await memberCountOf(tx, group.id) };
      });
    },
  };
}

export type StaticMemberWriter = ReturnType<typeof createStaticMemberWriter>;
