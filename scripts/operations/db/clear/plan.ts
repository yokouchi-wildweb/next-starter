// scripts/operations/db/clear/plan.ts
//
// pnpm db:clear の「消す計画」を立てる純関数(DB には触れない。実行は run.ts)。
//
// 考え方:
// - 閉じた機能の表(@/featureGate/node の closedTables)には触れない。選べる表からも参照元からも外す
//   (触れるのは --include-closed のときだけ)
// - TRUNCATE ... RESTRICT は「消す表を外部キーで参照する表」が同じ文に無いと失敗する。
//   そこで参照元を schemaRegistry の外部キーから先に推移的に足し、一覧で見せてから 1 文で消す(連鎖の削除は使わない)
// - DB に無い表は文を失敗させるので外す(無い表には制約も無いので、その先の参照元もたどらない)
// - DB にある閉じた表が消す表を参照していると RESTRICT で失敗する → 何も消さずに全部並べて止める
//
// 詳細: src/featureGate/README.md「db:clear と閉じた機能の表」

import { getTableName, is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";

/** 表の一覧と、表ごとの参照先(外部キーの相手。自己参照は除く) */
export type TableGraph = {
  /** 表名(schemaRegistry の順、重複なし) */
  names: string[];
  /** 表名 → その表が外部キーで参照する表名 */
  references: Map<string, string[]>;
};

/** schemaRegistry の export から表と外部キーを読む(pgTable 以外の export は無視) */
export function readTableGraph(schema: Record<string, unknown>): TableGraph {
  const names: string[] = [];
  const references = new Map<string, string[]>();
  for (const value of Object.values(schema)) {
    if (!is(value, PgTable)) continue;
    const name = getTableName(value);
    if (references.has(name)) continue;
    names.push(name);
    const targets = getTableConfig(value)
      .foreignKeys.map((fk) => getTableName(fk.reference().foreignTable))
      .filter((target) => target !== name);
    references.set(name, [...new Set(targets)]);
  }
  return { names, references };
}

export type SelectableTables = {
  /** 対話の選択肢と --all の対象 */
  selectable: string[];
  /** 閉じた機能の表なので選べない表(--include-closed のときは空) */
  excludedClosed: string[];
};

/** 選べる表: 閉じた表は --include-closed のときだけ選べる */
export function selectableTables(
  graph: TableGraph,
  closedTables: readonly string[],
  includeClosed: boolean,
): SelectableTables {
  const closed = new Set(closedTables);
  if (includeClosed) return { selectable: [...graph.names], excludedClosed: [] };
  return {
    selectable: graph.names.filter((name) => !closed.has(name)),
    excludedClosed: graph.names.filter((name) => closed.has(name)),
  };
}

export type ClearPlanInput = {
  graph: TableGraph;
  /** 今閉じている機能の表名 */
  closedTables: readonly string[];
  /** DB にある表名(current_schema の pg_tables) */
  dbTables: readonly string[];
  /** 選んだ表名 */
  selected: readonly string[];
  /** --include-closed: 閉じた表も選べ・参照元に足せる */
  includeClosed: boolean;
};

/** 止める理由: DB にある閉じた表 from が、消す表 to を外部キーで参照している */
export type ClearBlocker = { from: string; to: string };

export type ClearPlan = {
  /** TRUNCATE する表(選んだ表 + 足した参照元、graph の順) */
  tables: string[];
  /** 選んだ表のうち消す表 */
  selected: string[];
  /** 選んでいないが参照元として足した表 */
  addedReferrers: string[];
  /** DB に無いので外した表(選んだ表・参照元の両方) */
  missingInDb: string[];
  /** 閉じた機能の表なので外した、選んだ表(--include-closed でないとき) */
  skippedClosed: string[];
  /** 1 件でもあれば何も消さない */
  blockers: ClearBlocker[];
};

/** 選んだ表から消す計画を立てる */
export function planClear(input: ClearPlanInput): ClearPlan {
  const { graph, includeClosed } = input;
  const closed = new Set(input.closedTables);
  const inDb = new Set(input.dbTables);
  const known = new Set(graph.names);

  const unknown = input.selected.filter((name) => !known.has(name));
  if (unknown.length > 0) {
    throw new Error(`schemaRegistry に無い表が選ばれています: ${unknown.join(", ")}`);
  }

  // 参照元の逆引き: 表名 → その表を参照する表名
  const referrers = new Map<string, string[]>(graph.names.map((name) => [name, []]));
  for (const [from, targets] of graph.references) {
    for (const to of targets) referrers.get(to)?.push(from);
  }

  const isBlockedClosed = (name: string) => closed.has(name) && !includeClosed;

  const chosen = new Set<string>();
  const missing = new Set<string>();
  const skippedClosed: string[] = [];
  const queue: string[] = [];

  for (const name of new Set(input.selected)) {
    if (isBlockedClosed(name)) skippedClosed.push(name);
    else if (!inDb.has(name)) missing.add(name);
    else {
      chosen.add(name);
      queue.push(name);
    }
  }
  const selectedSet = new Set(chosen);

  // 参照元の推移の閉包(閉じた表と DB に無い表の先はたどらない)
  while (queue.length > 0) {
    const target = queue.shift()!;
    for (const from of referrers.get(target) ?? []) {
      if (chosen.has(from) || isBlockedClosed(from)) continue;
      if (!inDb.has(from)) {
        missing.add(from);
        continue;
      }
      chosen.add(from);
      queue.push(from);
    }
  }

  // 止める理由: DB にある閉じた表が消す表を参照している(全部列挙)
  const blockers: ClearBlocker[] = [];
  for (const to of graph.names) {
    if (!chosen.has(to)) continue;
    for (const from of referrers.get(to) ?? []) {
      if (isBlockedClosed(from) && inDb.has(from)) blockers.push({ from, to });
    }
  }

  const ordered = (set: Set<string>) => graph.names.filter((name) => set.has(name));
  return {
    tables: ordered(chosen),
    selected: ordered(selectedSet),
    addedReferrers: graph.names.filter((name) => chosen.has(name) && !selectedSet.has(name)),
    missingInDb: ordered(missing),
    skippedClosed: graph.names.filter((name) => skippedClosed.includes(name)),
    blockers,
  };
}

const quoteIdent = (name: string) => `"${name.replaceAll('"', '""')}"`;

/** 1 文の TRUNCATE(連鎖の削除は使わない。参照元は計画で足してある) */
export function buildTruncateSql(tables: readonly string[]): string {
  if (tables.length === 0) throw new Error("消す表がありません");
  return `TRUNCATE TABLE ${tables.map(quoteIdent).join(", ")} RESTRICT`;
}
