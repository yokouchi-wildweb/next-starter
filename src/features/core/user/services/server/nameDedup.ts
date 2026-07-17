// src/features/core/user/services/server/nameDedup.ts

import { sql } from "drizzle-orm";

import { USER_NAME_CONFIG } from "@/config/app/user-name.config";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { runAsSystem } from "@/lib/audit";
import { db } from "@/lib/drizzle";
import { base } from "./drizzleBase";
import { findAvailableSuffixedUserName } from "./helpers/nameAvailability";

export type UserNameDedupResult = {
  dryRun: boolean;
  /** 重複していた表示名グループ数 */
  duplicateGroups: number;
  /** リネーム対象 (dry-run 時は計画のみ) */
  renamed: Array<{ userId: string; from: string; to: string }>;
};

/**
 * 既存の重複表示名を一括解消する one-shot タスク (pnpm cron user-name-dedup)。
 *
 * USER_NAME_CONFIG.unique を有効化する際の移行手順として実行する:
 * 1. unique.enabled: true でデプロイ (以後の新規書き込みは検証される)
 * 2. 本タスクを --dry-run で実行して対象を確認
 * 3. dry-run なしで実行し、既存の重複をサフィックス付与で解消
 *
 * - 重複判定はランタイムチェックと同じ正規化 (normalizeUserNameForComparison /
 *   nameAvailability.ts と同一条件)。caseInsensitive 設定に追従する
 * - 各グループで createdAt 最古 (同時刻は id 昇順) のユーザーが元の名前を保持し、
 *   他のユーザーへ "名前_2", "名前_3", … を付与する (maxLength 内に収まるよう切り詰め)
 * - ソフトデリート済み・デモユーザーは対象外 (占有判定と同じスコープ)
 * - リネームは base.update 経由のため audit_logs に name 変更として記録される
 * - 冪等: 解消済みの状態で再実行しても何もしない
 */
export async function dedupUserNames(
  options: { dryRun?: boolean } = {},
): Promise<UserNameDedupResult> {
  const dryRun = options.dryRun ?? false;
  const caseInsensitive = USER_NAME_CONFIG.unique.caseInsensitive;

  // 正規化式はランタイムチェック (nameAvailability.ts) の SQL 側と揃えること
  const normExpr = caseInsensitive
    ? sql`lower(btrim(${UserTable.name}))`
    : sql`btrim(${UserTable.name})`;

  const duplicates = (await db.execute(sql`
    SELECT id, name, norm
    FROM (
      SELECT
        ${UserTable.id} AS id,
        ${UserTable.name} AS name,
        ${normExpr} AS norm,
        count(*) OVER (PARTITION BY ${normExpr}) AS group_size,
        row_number() OVER (
          PARTITION BY ${normExpr}
          ORDER BY ${UserTable.createdAt} ASC, ${UserTable.id} ASC
        ) AS rank
      FROM ${UserTable}
      WHERE ${UserTable.deletedAt} IS NULL
        AND ${UserTable.isDemo} = false
        AND ${UserTable.name} IS NOT NULL
        AND btrim(${UserTable.name}) <> ''
    ) ranked
    WHERE group_size > 1
    ORDER BY norm ASC, rank ASC
  `)) as unknown as Array<{ id: string; name: string; norm: string }>;

  const groups = new Map<string, Array<{ id: string; name: string }>>();
  for (const row of duplicates) {
    const group = groups.get(row.norm) ?? [];
    group.push({ id: row.id, name: row.name });
    groups.set(row.norm, group);
  }

  const renamed: UserNameDedupResult["renamed"] = [];
  // 本実行中に割り当て済みの名前 (DB 未反映の dry-run 計画分も含む) との衝突を防ぐ
  const reserved = new Set<string>();

  await runAsSystem(async () => {
    for (const members of groups.values()) {
      // 先頭 (createdAt 最古) は元の名前を保持
      for (const member of members.slice(1)) {
        const to = await findAvailableSuffixedUserName(member.name, { reserved });
        renamed.push({ userId: member.id, from: member.name, to });

        if (!dryRun) {
          await base.update(member.id, { name: to } as Parameters<typeof base.update>[1]);
        }
      }
    }
  });

  // 実行後の残存重複を検証 (dry-run 時はスキップ)
  if (!dryRun && renamed.length > 0) {
    const remaining = (await db.execute(sql`
      SELECT ${normExpr} AS norm, count(*) AS cnt
      FROM ${UserTable}
      WHERE ${UserTable.deletedAt} IS NULL
        AND ${UserTable.isDemo} = false
        AND ${UserTable.name} IS NOT NULL
        AND btrim(${UserTable.name}) <> ''
      GROUP BY 1
      HAVING count(*) > 1
    `)) as unknown as Array<{ norm: string }>;

    if (remaining.length > 0) {
      console.warn(
        `[user-name-dedup] 実行後も重複が残っています (実行中の同時書き込みの可能性): ${remaining
          .map((row) => row.norm)
          .join(", ")}。再実行してください`,
      );
    }
  }

  return {
    dryRun,
    duplicateGroups: groups.size,
    renamed,
  };
}
