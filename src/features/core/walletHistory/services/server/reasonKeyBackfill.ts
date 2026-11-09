// src/features/core/walletHistory/services/server/reasonKeyBackfill.ts
// 過去の wallet_histories の行に付与の種類(reason_key)を埋める(冪等・時間予算付き・dry-run あり)。
//
// 規則は引数で受ける(種類の項目には持たせない: 対応表は 1 回きりの移行の物で、済んだら消せるように)。
// 上流の分の規則 = src/features/core/walletHistory/scripts/tasks/reason-key-backfill.ts、fork の分 = fork の 1 回きりの task ファイル。
// - 対象: reason_key IS NULL かつ reason_category ∈ fromCategories(既定 [その種類の category])かつ reason がどれかの
//   reasonPatterns(SQL の LIKE。% は規則に書く)に一致する行
// - 2 つ以上の規則に一致する行は書かずに conflicts に数える(どちらの種類か決められない)
// - 書くと reason_key = key、reason_category = 種類の category。fromCategories に別の区分(導入前の other など)を入れたときだけ
//   区分も書き換わる = fork が明示して選ぶやり方で、過去の期間の合計(コイン創出の wallet_bonus_grant など)が変わる
// - 冪等: 書いた行は IS NULL から外れる。途中で締切に当たっても再実行で続きから
// 文の解釈(LIKE)はこの移行の中だけ。集計の時に文を解かない。

import { and, asc, count, gt, inArray, isNull, like, or, sql, type SQL } from "drizzle-orm";

import { walletHistoryConfig, type ReasonCategory } from "@/features/walletHistory/config";
import { createDeadline, runBudgetedBatches, type BudgetedBatchesStopReason } from "@/lib/cron";
import { db } from "@/lib/drizzle";
import { WalletHistoryTable } from "@/features/core/walletHistory/entities/drizzle";
import type { WalletReasonKeyItem } from "@/features/core/walletHistory/types/reasonKey";
import { getWalletReasonKey } from "@/features/core/walletHistory/utils/reasonKey";

const t = WalletHistoryTable;

/** 1 つの付与の種類の埋め方 */
export type WalletReasonKeyBackfillRule = {
  /** 書く種類(walletHistory/reasonKeys に登録済みであること) */
  key: string;
  /** reason の LIKE のパターン(どれかに一致すれば対象。例: "ランクボーナス:%") */
  reasonPatterns: readonly string[];
  /**
   * 対象にする今の区分(既定 = [種類の category])。別の区分を入れると、その行の区分も種類の category に書き換わる
   * (reason_category の導入前の行は other で埋まっている。拾うなら ["bonus", "other"] など。過去の合計が変わる)
   */
  fromCategories?: readonly ReasonCategory[];
  /** reason が NULL の行も対象にする(LIKE は NULL に一致しないため。既定 false) */
  includeNullReason?: boolean;
};

export type WalletReasonKeyBackfillOptions = {
  /** true = 数えるだけで書かない */
  dryRun?: boolean;
  /** 締切(既定 = 今から 4 分)。チャンクの境界で止まり、再実行で続きから */
  deadline?: Date;
  /** 1 チャンクの行数(既定 1000) */
  chunkSize?: number;
};

export type WalletReasonKeyBackfillResult = {
  dryRun: boolean;
  rules: Array<{
    key: string;
    /** 一致した行(競合を除く)。dry-run では書く予定の数 */
    matched: number;
    /** 書いた行(dry-run では 0) */
    written: number;
    /** 区分も書き換わる / 書き換わった行(fromCategories に別の区分を入れたときだけ 0 より大きい) */
    categoryRewrites: number;
  }>;
  /** 2 つ以上の規則に一致して書かなかった行 */
  conflicts: number;
  /** requiresKey の区分で、どの規則にも一致せず種類の無いままの行 */
  unmatchedRequiresKey: number;
  /** 書いたときの止まり方(dry-run は "exhausted") */
  stopReason: BudgetedBatchesStopReason;
};

/** 規則の確かめ(未登録の key・パターンなしは例外)と、種類の項目 */
export function resolveBackfillRules(
  rules: readonly WalletReasonKeyBackfillRule[],
  lookup: (key: string) => WalletReasonKeyItem | undefined = getWalletReasonKey,
): Array<{ rule: WalletReasonKeyBackfillRule; item: WalletReasonKeyItem; fromCategories: ReasonCategory[] }> {
  const seen = new Set<string>();
  return rules.map((rule) => {
    const item = lookup(rule.key);
    if (!item) throw new Error(`付与の種類 "${rule.key}" は登録されていません(walletHistory/reasonKeys)`);
    if (seen.has(rule.key)) throw new Error(`付与の種類 "${rule.key}" の規則が 2 つあります(パターンは 1 つの規則にまとめる)`);
    seen.add(rule.key);
    if (rule.reasonPatterns.length === 0 && !rule.includeNullReason) throw new Error(`付与の種類 "${rule.key}" の reasonPatterns が空です`);
    const fromCategories = [...(rule.fromCategories && rule.fromCategories.length > 0 ? rule.fromCategories : [item.category])];
    return { rule, item, fromCategories };
  });
}

/** 規則 1 つの一致の条件(reason_key IS NULL・区分・LIKE) */
export function backfillMatchCondition(rule: WalletReasonKeyBackfillRule, fromCategories: readonly ReasonCategory[]): SQL {
  return and(
    isNull(t.reason_key),
    inArray(t.reason_category, [...fromCategories]),
    or(
      ...rule.reasonPatterns.map((pattern) => like(t.reason, pattern)),
      ...(rule.includeNullReason ? [isNull(t.reason)] : []),
    ),
  )!;
}

/** 一致した規則の数(競合 = 2 以上) */
function matchCountExpr(conditions: readonly SQL[]): SQL<number> {
  return sql<number>`(${sql.join(conditions.map((c) => sql`(CASE WHEN ${c} THEN 1 ELSE 0 END)`), sql` + `)})`;
}

export async function backfillWalletReasonKeys(
  rules: readonly WalletReasonKeyBackfillRule[],
  options: WalletReasonKeyBackfillOptions = {},
): Promise<WalletReasonKeyBackfillResult> {
  const resolved = resolveBackfillRules(rules);
  const dryRun = options.dryRun ?? false;
  const chunkSize = options.chunkSize ?? 1000;
  const deadline = options.deadline ?? createDeadline(240_000);
  const conditions = resolved.map(({ rule, fromCategories }) => backfillMatchCondition(rule, fromCategories));
  const matchCount = matchCountExpr(conditions);
  const requiresKeyCategories = (Object.keys(walletHistoryConfig.reasonCategory) as ReasonCategory[]).filter(
    (key) => (walletHistoryConfig.reasonCategory[key] as { requiresKey?: boolean }).requiresKey,
  );

  const countWhere = async (where: SQL | undefined) =>
    Number((await db.select({ n: count() }).from(t).where(where))[0]?.n ?? 0);

  const summary: WalletReasonKeyBackfillResult["rules"] = [];
  let stopReason: BudgetedBatchesStopReason = "exhausted";

  for (let i = 0; i < resolved.length; i++) {
    const { rule, item } = resolved[i]!;
    const only = and(conditions[i], sql`${matchCount} = 1`)!;
    const matched = await countWhere(only);
    const categoryRewrites = await countWhere(and(only, sql`${t.reason_category} <> ${item.category}`));
    let written = 0;
    if (!dryRun && matched > 0 && stopReason === "exhausted") {
      const result = await runBudgetedBatches<{ id: string }, string>({
        deadline,
        fetchNext: async (cursor) => {
          const rows = await db
            .select({ id: t.id })
            .from(t)
            .where(cursor ? and(only, gt(t.id, cursor)) : only)
            .orderBy(asc(t.id))
            .limit(chunkSize);
          if (rows.length === 0) return null;
          return { items: rows, cursor: rows[rows.length - 1]!.id, done: rows.length < chunkSize };
        },
        processChunk: async (rows) => {
          await db
            .update(t)
            .set({ reason_key: item.key, reason_category: item.category })
            .where(and(inArray(t.id, rows.map((r) => r.id)), isNull(t.reason_key)));
        },
      });
      written = result.processed;
      stopReason = result.stopReason;
    }
    summary.push({ key: rule.key, matched, written, categoryRewrites });
  }

  const conflicts = await countWhere(sql`${matchCount} > 1`);
  const unmatchedRequiresKey =
    requiresKeyCategories.length === 0
      ? 0
      : await countWhere(and(isNull(t.reason_key), inArray(t.reason_category, requiresKeyCategories), sql`${matchCount} = 0`));

  return { dryRun, rules: summary, conflicts, unmatchedRequiresKey, stopReason };
}

/** 上流の書き手の分の規則(上流の task が使う。fork は自分の task で自分の規則を渡す) */
export const UPSTREAM_REASON_KEY_BACKFILL_RULES: readonly WalletReasonKeyBackfillRule[] = [
  // クーポン帰属報酬の付与(couponAttributionReward/services/server/grant.ts の既定の reason)
  { key: "coupon_attribution_reward", reasonPatterns: ["クーポン帰属報酬%"] },
  // 管理者の調整(区分 admin_adjustment の行は全部この種類)
  { key: "admin_adjustment", reasonPatterns: ["%"], includeNullReason: true },
];
