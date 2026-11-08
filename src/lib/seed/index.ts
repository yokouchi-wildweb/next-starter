// src/lib/seed/index.ts — ドメインのシード(src/features/<ドメイン>/seed.ts)の書き方と、入れる順の計画(公開の入口はこの 1 つ)
// seed.ts = export const seed = defineSeed({ after?, tables: { <表>: [{ $key, $unique?, ...列の値 }] } })、関係先は ref(<ドメイン>, <$key>)。
// 入れるのは scripts/runner/seed(各ドメインのサービスの create)。この lib は形・検査・順・値の置き換えだけ(DB にも features にも触らない)。
// 依存なし(features・棚・@/wiring を読まない)。README.md

export type SeedRef = { readonly $ref: { readonly domain: string; readonly key: string } };

/** 1 行。$key = そのドメインの中で一意の名前(ref で指す)、$unique = 既にあるかを探す列(あれば入れずにその行を使う) */
export type SeedRow = {
  readonly $key: string;
  readonly $unique?: readonly string[];
  readonly [column: string]: unknown;
};

export type SeedDefinition = {
  /** 先に入れるドメイン(ref で指すドメインは全部ここに書く) */
  readonly after?: readonly string[];
  /** 表の名前(DB の表名)→ 行。行の列の名前は表の定義(drizzle)の列のキー */
  readonly tables: Readonly<Record<string, readonly SeedRow[]>>;
};

/** 関係先の行(先に入れたドメインの $key の行)の id を指す */
export function ref(domain: string, key: string): SeedRef {
  return { $ref: { domain, key } };
}

export const isSeedRef = (value: unknown): value is SeedRef =>
  typeof value === "object" && value !== null && "$ref" in value && typeof (value as SeedRef).$ref?.domain === "string";

/** シードを定義する(形を確かめて返す: $key の形・重複、$unique の列が行にあること) */
export function defineSeed(definition: SeedDefinition): SeedDefinition {
  const keys = new Set<string>();
  for (const [table, rows] of Object.entries(definition.tables)) {
    if (!Array.isArray(rows)) throw new Error(`seed: 表 ${table} の値は行の配列です`);
    for (const row of rows) {
      if (typeof row.$key !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(row.$key)) throw new Error(`seed: 表 ${table} の行の $key "${String(row.$key)}" は英数字・_・- の名前です`);
      if (keys.has(row.$key)) throw new Error(`seed: $key "${row.$key}" が 2 つあります(ドメインの中で一意)`);
      keys.add(row.$key);
      for (const column of row.$unique ?? []) {
        if (!(column in row) || column.startsWith("$")) throw new Error(`seed: 表 ${table} の行 ${row.$key} の $unique の列 ${column} が行にありません`);
      }
    }
  }
  return definition;
}

export type SeedEntry = {
  domain: string;
  /** src/features からの相対のフォルダ(例 sample・core/user)。閉じた機能の判定に使う */
  folder: string;
  file: string;
  seed: SeedDefinition;
  /** 閉じている規則の名前(開いていれば null) */
  closedBy: string | null;
};

export type SeedPlan = {
  /** 入れる順のドメイン */
  order: SeedEntry[];
  /** 閉じた機能のため飛ばすドメイン */
  skipped: { domain: string; closedBy: string }[];
  /** 止める理由(1 つでもあれば何も入れない) */
  problems: string[];
};

/** ref を全部集める(配列の中も) */
function refsIn(value: unknown, out: SeedRef[] = []): SeedRef[] {
  if (isSeedRef(value)) out.push(value);
  else if (Array.isArray(value)) for (const item of value) refsIn(item, out);
  return out;
}

/**
 * 入れる順を決める。selected(省略 = 全部)が after で指すドメインは自動で足す。
 * 止める: 知らないドメインの after・循環・after に無いドメインへの ref・無い $key への ref・閉じたドメインを after に持つ物
 */
export function planSeeds(entries: readonly SeedEntry[], selected?: readonly string[]): SeedPlan {
  const byDomain = new Map(entries.map((entry) => [entry.domain, entry]));
  const problems: string[] = [];
  const keysOf = (domain: string) => new Set(Object.values(byDomain.get(domain)?.seed.tables ?? {}).flatMap((rows) => rows.map((row) => row.$key)));

  for (const entry of entries) {
    const after = new Set(entry.seed.after ?? []);
    for (const dep of after) if (!byDomain.has(dep)) problems.push(`${entry.file}: after の ${dep} にシードがありません`);
    for (const rows of Object.values(entry.seed.tables)) {
      for (const row of rows) {
        for (const r of Object.values(row).flatMap((value) => refsIn(value))) {
          const { domain, key } = r.$ref;
          if (domain !== entry.domain && !after.has(domain)) problems.push(`${entry.file}: 行 ${row.$key} の ref(${domain}, ${key}) のドメインが after にありません`);
          else if (byDomain.has(domain) && !keysOf(domain).has(key)) problems.push(`${entry.file}: 行 ${row.$key} の ref(${domain}, ${key}) の $key がありません`);
        }
      }
    }
  }

  const wanted = new Set<string>();
  const want = (domain: string) => {
    if (wanted.has(domain) || !byDomain.has(domain)) return;
    wanted.add(domain);
    for (const dep of byDomain.get(domain)?.seed.after ?? []) want(dep);
  };
  for (const domain of selected ?? entries.map((entry) => entry.domain)) want(domain);

  const skipped: SeedPlan["skipped"] = [];
  const order: SeedEntry[] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (domain: string, path: string[]) => {
    const entry = byDomain.get(domain);
    if (!entry || state.get(domain) === "done") return;
    if (state.get(domain) === "visiting") {
      problems.push(`シードの after が循環しています: ${[...path, domain].join(" → ")}`);
      return;
    }
    state.set(domain, "visiting");
    for (const dep of entry.seed.after ?? []) visit(dep, [...path, domain]);
    state.set(domain, "done");
    if (entry.closedBy !== null) {
      skipped.push({ domain, closedBy: entry.closedBy });
      return;
    }
    const closedDeps = (entry.seed.after ?? []).filter((dep) => byDomain.get(dep)?.closedBy != null);
    if (closedDeps.length > 0) {
      problems.push(`${entry.file}: 先に入れるドメイン ${closedDeps.join(", ")} が閉じた機能なので入れられません(その機能を開くか、このシードを外す)`);
      return;
    }
    order.push(entry);
  };
  for (const entry of entries) if (wanted.has(entry.domain)) visit(entry.domain, []);
  return { order, skipped, problems: [...new Set(problems)] };
}

/** 行から $ の欄を外し、ref を入れた行の id に置き換えた値(ids のキー = <ドメイン>:<$key>) */
export function resolveRow(row: SeedRow, ids: ReadonlyMap<string, unknown>): Record<string, unknown> {
  const resolve = (value: unknown): unknown => {
    if (isSeedRef(value)) {
      const id = ids.get(`${value.$ref.domain}:${value.$ref.key}`);
      if (id === undefined) throw new Error(`seed: ref(${value.$ref.domain}, ${value.$ref.key}) の行がまだ入っていません`);
      return id;
    }
    return Array.isArray(value) ? value.map(resolve) : value;
  };
  return Object.fromEntries(Object.entries(row).filter(([column]) => !column.startsWith("$")).map(([column, value]) => [column, resolve(value)]));
}
