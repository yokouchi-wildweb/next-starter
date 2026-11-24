// src/lib/cron/expiry.ts
// 期限で行を消す 1 本の定期処理(D25・D26)。項目 = 増設点 expiryRules の 1 つの削除の規則(<ドメイン>/plugs/expiryRules/<名前>.ts の export const rule)。
// - 1 本: 外の取引で pg_try_advisory_xact_lock(取れなければ待たずに locked)。外の取引は行の鍵を持たない
// - 順: 項目ごとの印(cronCheckpoint の名前 expiry-prune:<差した側>/<名前> = 最後に消し切った時)の古い順。予算で切れた項目は印が古いまま = 次の回の先頭
// - 1 束: WITH d AS (DELETE … WHERE key IN (SELECT key … WHERE <規則> [AND (<where>)] ORDER BY <列> LIMIT n FOR UPDATE SKIP LOCKED) RETURNING 1)
//   SELECT count(*)、runBudgetedBatches + 締切の内で消し切るまで
// - 消すだけ(後処理の口は無い)。表・列の名前は項目の字面(識別子の形だけを通し、sql.identifier で括る)
// 依存(表の読み書き・印)は渡す: lib はドメインを読まない。本物の表は ./expiryStore.ts(入口 ./server)、本物の束は src/wiring/expiryPrune.ts

import { sql, type SQL } from "drizzle-orm";

import { runBudgetedBatches } from "./runBudgetedBatches";

/** 消す規則: expiresAt = 列の時刻が今より前 / age = 列の時刻から days 日 / rowDays = 列の時刻 + 行の日数の列 */
export type ExpiryRuleKind =
  | { kind: "expiresAt"; column: string }
  | { kind: "age"; column: string; days: number | (() => number) }
  | { kind: "rowDays"; column: string; daysColumn: string };

/** 増設点 expiryRules の項目(fork の上書き <名前>.override.ts で変えられるのは enabled・batchSize だけ) */
export type ExpiryRule = {
  /** 表の名前(字面) */
  table: string;
  /** 行を指す列(主キー、字面) */
  key: string;
  rule: ExpiryRuleKind;
  /** 消す行を絞るだけの条件(drizzle の sql``) */
  where?: SQL;
  /** 1 束の行の数(既定 1000、1〜10000) */
  batchSize?: number;
  /** 個人情報の削除: true なら上書きで enabled: false にできない(生成と検査が止める、pii_prune_kept) */
  pii?: boolean;
  /** 既定 true。上流の項目は書かない(fork の上書きの鍵) */
  enabled?: boolean;
};

/** 生成された一覧の 1 項目(門番で絞った後) */
export type ExpiryRuleItem = { domain: string | null; name: string; plug: ExpiryRule };

export type ExpiryStore = {
  /** 1 本に絞る。取れなければ fn を呼ばずに { locked: false } */
  withTryLock<T>(key: string, fn: () => Promise<T>): Promise<{ locked: true; value: T } | { locked: false }>;
  /** 1 束を消し、消した行の数 */
  deleteBatch(rule: ExpiryRule, batchSize: number, now: Date): Promise<number>;
};

export type ExpiryCheckpoint = {
  /** 名前の印(無ければ fallback) */
  get(name: string, fallback: Date): Promise<Date>;
  /** 印を進める(単調) */
  advance(name: string, ts: Date): Promise<unknown>;
};

export type ExpiryItemResult = { name: string; deleted: number; exhausted: boolean };

export type ExpiryRunResult = {
  /** no-items = 項目 0(すぐ返す)/ locked = 他の実行が鍵を持つ */
  skipped?: "no-items" | "locked";
  items: ExpiryItemResult[];
  /** 締切で残した項目がある(次の回の先頭) */
  truncated: boolean;
};

export const EXPIRY_LOCK_KEY = "cron:expiry-prune";
export const EXPIRY_CHECKPOINT_PREFIX = "expiry-prune:";
export const EXPIRY_DEFAULT_BATCH = 1000;
const IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;

/** 項目の名前(印の名前): <差した側>/<名前> */
export const expiryItemName = (item: ExpiryRuleItem) => `${item.domain ?? "lib"}/${item.name}`;

/** 項目の字面の確かめ。問題の文の一覧(空 = 使える) */
export function expiryRuleProblems(rule: ExpiryRule): string[] {
  const problems: string[] = [];
  const ids: Array<[string, string]> = [["table", rule.table], ["key", rule.key], ["rule.column", rule.rule.column]];
  if (rule.rule.kind === "rowDays") ids.push(["rule.daysColumn", rule.rule.daysColumn]);
  for (const [field, value] of ids) if (!IDENTIFIER.test(value)) problems.push(`${field} "${value}" は小文字・数字・_ の名前`);
  const batch = rule.batchSize ?? EXPIRY_DEFAULT_BATCH;
  if (!Number.isInteger(batch) || batch < 1 || batch > 10_000) problems.push(`batchSize ${batch} は 1〜10000 の整数`);
  if (rule.rule.kind === "age" && typeof rule.rule.days === "number" && !(rule.rule.days > 0)) problems.push(`days ${rule.rule.days} は正の数`);
  return problems;
}

/** 規則の条件(純関数、テストで字面を見る) */
export function expiryCondition(rule: ExpiryRule, now: Date): SQL {
  const at = sql`${now.toISOString()}::timestamptz`;
  const column = sql.identifier(rule.rule.column);
  const base =
    rule.rule.kind === "expiresAt"
      ? sql`${column} < ${at}`
      : rule.rule.kind === "age"
        ? sql`${column} < ${at} - make_interval(days => ${ageDays(rule.rule.days)})`
        : sql`${column} + (${sql.identifier(rule.rule.daysColumn)} * INTERVAL '1 day') < ${at}`;
  return rule.where ? sql`${base} AND (${rule.where})` : base;
}

function ageDays(days: number | (() => number)): number {
  const value = typeof days === "function" ? days() : days;
  if (!(value > 0)) throw new Error(`expiry: days ${value} は正の数`);
  return Math.floor(value);
}

/** 1 束の DELETE(純関数) */
export function expiryDeleteQuery(rule: ExpiryRule, batchSize: number, now: Date): SQL {
  const table = sql.identifier(rule.table);
  const key = sql.identifier(rule.key);
  return sql`WITH d AS (DELETE FROM ${table} WHERE ${key} IN (SELECT ${key} FROM ${table} WHERE ${expiryCondition(rule, now)} ORDER BY ${sql.identifier(rule.rule.column)} LIMIT ${batchSize} FOR UPDATE SKIP LOCKED) RETURNING 1) SELECT count(*)::int AS n FROM d`;
}

/**
 * 1 回の実行。items = 門番で絞った一覧(src/wiring/expiryPrune.ts が渡す)
 * @throws Error 項目の字面が使えない(消す前に止める)
 */
export async function runExpiryRules(options: {
  items: readonly ExpiryRuleItem[];
  store: ExpiryStore;
  checkpoint: ExpiryCheckpoint;
  deadline: Date;
  now?: () => Date;
}): Promise<ExpiryRunResult> {
  const now = options.now ?? (() => new Date());
  const items = options.items.filter((item) => item.plug.enabled !== false);
  if (items.length === 0) return { skipped: "no-items", items: [], truncated: false };
  for (const item of items) {
    const problems = expiryRuleProblems(item.plug);
    if (problems.length > 0) throw new Error(`expiry: 項目 ${expiryItemName(item)}: ${problems.join(" / ")}`);
  }
  const startedAt = now();
  const run = await options.store.withTryLock(EXPIRY_LOCK_KEY, async () => {
    const marks = await Promise.all(items.map((item) => options.checkpoint.get(`${EXPIRY_CHECKPOINT_PREFIX}${expiryItemName(item)}`, new Date(0))));
    const ordered = items
      .map((item, index) => ({ item, mark: marks[index].getTime() }))
      .sort((a, b) => a.mark - b.mark || expiryItemName(a.item).localeCompare(expiryItemName(b.item)));
    const results: ExpiryItemResult[] = [];
    let truncated = false;
    for (const { item } of ordered) {
      if (Date.now() >= options.deadline.getTime()) {
        truncated = true;
        break;
      }
      const batchSize = item.plug.batchSize ?? EXPIRY_DEFAULT_BATCH;
      let deleted = 0;
      const batches = await runBudgetedBatches<number, null>({
        deadline: options.deadline,
        fetchNext: async () => {
          const n = await options.store.deleteBatch(item.plug, batchSize, now());
          if (n === 0) return null;
          return { items: [n], cursor: null, done: n < batchSize };
        },
        processChunk: async ([n]) => {
          deleted += n;
        },
      });
      const exhausted = batches.exhausted;
      results.push({ name: expiryItemName(item), deleted, exhausted });
      if (!exhausted) {
        truncated = true;
        break;
      }
      await options.checkpoint.advance(`${EXPIRY_CHECKPOINT_PREFIX}${expiryItemName(item)}`, startedAt);
    }
    return { items: results, truncated };
  });
  if (!run.locked) return { skipped: "locked", items: [], truncated: false };
  return run.value;
}
