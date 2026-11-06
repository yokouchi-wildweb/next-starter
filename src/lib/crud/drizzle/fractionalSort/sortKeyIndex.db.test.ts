// src/lib/crud/drizzle/fractionalSort/sortKeyIndex.db.test.ts
// sortKeyIndexColumn の index が drizzle-kit の push で round-trip し、COLLATE "C" の読み方に使われることの実 DB テスト。
// drizzle-kit の更新で opclass の扱いが変わるとここが落ちる。
// 開発 DB に専用の表 test_crud_sortidx_* を作り、終了時に DROP する。実行する文はその表を名指しするものだけ
// （1 表だけの import では他の enum の DROP TYPE も提案される。それらは実行しない）。
// DATABASE_URL が無ければ DB のケースは skip。
// 実行: pnpm test --db src/lib/crud/drizzle/fractionalSort/sortKeyIndex.db.test.ts

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";
import { getTableConfig, index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { sortKeyIndexColumn } from "./sortKeyOrder";

const envFile = resolve(process.cwd(), process.env.ENV_FILE ?? ".env.development");
if (existsSync(envFile)) loadEnv({ path: envFile, quiet: true });

const skip = (process.env.DATABASE_URL ?? "").trim().length === 0;

const SINGLE = "test_crud_sortidx_single";
const COMPOSITE = "test_crud_sortidx_composite";
const PLAIN = "test_crud_sortidx_plain";

const columns = {
  id: uuid("id").primaryKey().defaultRandom(),
  p: uuid("p"),
  k: text("k"),
};

const singleTable = pgTable(SINGLE, columns, (t) => [index(`${SINGLE}_idx`).on(sortKeyIndexColumn(t.k))]);
const compositeTable = pgTable(COMPOSITE, columns, (t) => [index(`${COMPOSITE}_idx`).on(t.p, sortKeyIndexColumn(t.k))]);
const plainBefore = pgTable(PLAIN, columns, (t) => [index(`${PLAIN}_idx`).on(t.k)]);
const plainAfter = pgTable(PLAIN, columns, (t) => [index(`${PLAIN}_idx`).on(sortKeyIndexColumn(t.k))]);

describe("sortKeyIndexColumn の宣言", () => {
  test("text の列には COLLATE \"C\"、integer の列には何も足さない", () => {
    const table = pgTable(
      "test_crud_sortidx_decl",
      { k: text("k"), n: integer("n") },
      (t) => [index("a").on(sortKeyIndexColumn(t.k)), index("b").on(sortKeyIndexColumn(t.n))],
    );
    const [text_, int_] = getTableConfig(table).indexes.map((i) => i.config.columns[0] as any);
    assert.equal(text_.indexConfig.opClass, 'COLLATE "C"');
    assert.equal(int_.indexConfig.opClass, undefined);
  });

  test("降順・NULLS FIRST の列は例外", () => {
    for (const set of ["desc", "nullsFirst"] as const) {
      const table = pgTable(`test_crud_sortidx_${set}`, { k: text("k") }, (t) => [
        // @ts-expect-error 向きを付けた列は渡せない
        index("a").on(sortKeyIndexColumn(t.k[set]())),
      ]);
      assert.throws(() => getTableConfig(table), /昇順 NULLS LAST/);
    }
  });

  test("戻り値に向きを足せない（型）", () => {
    const table = pgTable("test_crud_sortidx_type", { k: text("k") }, (t) => [
      // @ts-expect-error desc は隠している
      index("a").on(sortKeyIndexColumn(t.k).desc?.() ?? t.k),
    ]);
    assert.equal(getTableConfig(table).indexes.length, 1);
  });
});

describe("sortKeyIndexColumn の round trip（実 DB）", { skip }, () => {
  let client: any;
  let db: any;
  let pushSchema: typeof import("drizzle-kit/api").pushSchema;

  /** その表の差分を計算する（他の対象の文は返さない。実行もしない） */
  const diff = async (table: unknown, name: string): Promise<string[]> => {
    const { statementsToExecute } = await pushSchema({ table } as any, db, undefined, [name]);
    return (statementsToExecute as string[]).filter((statement) => statement.includes(name));
  };
  const push = async (table: unknown, name: string) => {
    const statements = await diff(table, name);
    for (const statement of statements) await client.unsafe(statement);
    return statements;
  };
  const dropAll = async () => {
    for (const name of [SINGLE, COMPOSITE, PLAIN]) await client.unsafe(`DROP TABLE IF EXISTS "${name}"`);
  };
  /** index の最後の列の照合順序 */
  const lastCollation = async (indexName: string): Promise<string> => {
    const [row] = await client.unsafe(
      `select c.collname from pg_class ic join pg_index i on i.indexrelid = ic.oid
       join pg_collation c on c.oid = i.indcollation[i.indnatts - 1]
       where ic.relname = $1`,
      [indexName],
    );
    return row.collname;
  };
  const plan = async (query: string): Promise<string> => {
    const rows = await client.unsafe(`EXPLAIN ${query}`);
    return rows.map((row: any) => row["QUERY PLAN"]).join("\n");
  };
  const seed = async (name: string) => {
    await client.unsafe(
      `insert into "${name}" (p, k)
       select ('00000000-0000-0000-0000-00000000000' || (g % 8))::uuid, md5(g::text)
       from generate_series(1, 20000) g`,
    );
    await client.unsafe(`ANALYZE "${name}"`);
  };

  before(async () => {
    const [{ default: postgres }, { drizzle }, kit] = await Promise.all([
      import("postgres"),
      import("drizzle-orm/postgres-js"),
      import("drizzle-kit/api"),
    ]);
    pushSchema = kit.pushSchema;
    client = postgres(process.env.DATABASE_URL as string, { prepare: false, max: 1, onnotice: () => {} });
    db = drizzle(client);
    await dropAll();
  });

  after(async () => {
    await dropAll();
    const left = await client.unsafe(`select tablename from pg_tables where tablename like 'test_crud_sortidx_%'`);
    await client.end();
    assert.equal(left.length, 0);
  });

  test("単一列: 2 回目の push は 0 文、照合順序は C、並びに使われる", async () => {
    assert.ok((await push(singleTable, SINGLE)).length > 0);
    assert.deepEqual(await diff(singleTable, SINGLE), []);
    assert.equal(await lastCollation(`${SINGLE}_idx`), "C");
    await seed(SINGLE);
    const explained = await plan(`select id from "${SINGLE}" order by k collate "C" asc nulls last limit 20`);
    assert.match(explained, new RegExp(`${SINGLE}_idx`), explained);
  });

  test("複合: 2 回目の push は 0 文、照合順序は C、並びに使われる", async () => {
    assert.ok((await push(compositeTable, COMPOSITE)).length > 0);
    assert.deepEqual(await diff(compositeTable, COMPOSITE), []);
    assert.equal(await lastCollation(`${COMPOSITE}_idx`), "C");
    await seed(COMPOSITE);
    const explained = await plan(
      `select id from "${COMPOSITE}" where p = '00000000-0000-0000-0000-000000000001'
       order by k collate "C" asc nulls last limit 20`,
    );
    assert.match(explained, new RegExp(`${COMPOSITE}_idx`), explained);
    assert.doesNotMatch(explained, /\bSort\b(?! Key)/, explained);
  });

  test("既にある普通の index を書き換えても push は気づかない（名前を変えて作り直す根拠）", async () => {
    await push(plainBefore, PLAIN);
    const before_ = await lastCollation(`${PLAIN}_idx`);
    assert.notEqual(before_, "C");
    assert.deepEqual(await diff(plainAfter, PLAIN), []);
    assert.equal(await lastCollation(`${PLAIN}_idx`), before_);
  });
});
