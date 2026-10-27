// src/lib/crud/drizzle/fractionalSort/sortCollation.db.test.ts
// 並びの鍵（fractional の text の鍵）を並べる・比べる lib の経路が、列の照合順序に依らず鍵の順（COLLATE "C"）に
// なることの実 DB テスト。開発 DB に専用の表 test_crud_sort_coll / test_crud_sort_int を作り、終了時に DROP する。
// C 以外の照合順序（ICU / glibc の en_US）が DB に無ければ、その照合順序のケースは明示して飛ばす。
// DATABASE_URL が無ければ全件 skip。
// 実行: pnpm test:crud-sort-collation-db

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";
import { asc, sql } from "drizzle-orm";
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { generateInitialSortKeys } from "@/lib/crud/drizzle/fractionalSort";

const envFile = resolve(process.cwd(), process.env.APP_ENV ?? ".env.development");
if (existsSync(envFile)) loadEnv({ path: envFile, quiet: true });

const skip = (process.env.DATABASE_URL ?? "").trim().length === 0;

// searchForSorting / reorder は列の DB 名をフィールド名に使うので、キーを DB 名と揃える
const SortTable = pgTable("test_crud_sort_coll", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  sort_order: text("sort_order"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

const IntSortTable = pgTable("test_crud_sort_int", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  sort_order: integer("sort_order"),
});

// C と順序が変わる照合順序の候補（大文字小文字を一次で区別しない）
const NON_C_COLLATIONS = ["en-US-x-icu", "und-x-icu", "en_US.utf8", "en_US.UTF-8"];

type Row = Record<string, any>;

// 40 件の鍵 a0..a9 aA..aZ aa..ad（大文字と小文字が混ざる）
const KEYS = generateInitialSortKeys(40);
// バイト順の比較（fractional-indexing と同じ）
const byteLess = (a: string, b: string) => a < b;

describe("並びの鍵の照合順序（COLLATE \"C\"）", { skip }, () => {
  let db: typeof import("@/lib/drizzle").db;
  let createCrudService: typeof import("@/lib/crud/drizzle").createCrudService;
  let buildOrderBy: typeof import("@/lib/crud/drizzle").buildOrderBy;
  let server: typeof import("@/lib/crud/drizzle/fractionalSort/server");
  let nonCCollation: string | undefined;
  let sorted: any;

  before(async () => {
    ({ db } = await import("@/lib/drizzle"));
    ({ createCrudService, buildOrderBy } = await import("@/lib/crud/drizzle"));
    server = await import("@/lib/crud/drizzle/fractionalSort/server");

    await db.execute(sql`drop table if exists test_crud_sort_coll`);
    await db.execute(sql`drop table if exists test_crud_sort_int`);
    await db.execute(sql`create table test_crud_sort_int (id uuid primary key, name text not null, sort_order integer)`);
    const found = (await db.execute(sql`
      select collname from pg_collation where collname in (${sql.join(NON_C_COLLATIONS.map((name) => sql`${name}`), sql`, `)})
    `)) as unknown as Row[];
    nonCCollation = NON_C_COLLATIONS.find((name) => found.some((row) => row.collname === name));
    if (nonCCollation) {
      console.log(`non-C collation case RAN with collation "${nonCCollation}"`);
      await db.execute(sql`
        create table test_crud_sort_coll (
          id uuid primary key,
          name text not null,
          sort_order text collate ${sql.identifier(nonCCollation)},
          created_at timestamptz default now(),
          deleted_at timestamptz
        )
      `);
    } else {
      console.log(`skipped: no non-C collation (${NON_C_COLLATIONS.join(", ")}) in this DB`);
    }
    sorted = createCrudService(SortTable as never, {
      idType: "uuid",
      useSoftDelete: true,
      sortOrderColumn: SortTable.sort_order,
      defaultOrderBy: [["sort_order", "ASC"]],
    });
  });

  after(async () => {
    if (!db) return;
    await db.execute(sql`drop table if exists test_crud_sort_coll`);
    await db.execute(sql`drop table if exists test_crud_sort_int`);
    await (db as unknown as { $client?: { end: () => Promise<void> } }).$client?.end();
  });

  /** C 以外の照合順序が無ければ明示して飛ばす */
  const needsNonC = (t: { skip: (message: string) => void }): boolean => {
    if (nonCCollation) return true;
    t.skip(`skipped: no non-C collation (${NON_C_COLLATIONS.join(", ")}) in this DB`);
    return false;
  };

  /** 表を空にして、鍵の行を入れる（入れる順は逆順、id は乱数）。null は並びの無い行 */
  const seed = async (keys: (string | null)[]): Promise<Row[]> => {
    await db.execute(sql`delete from test_crud_sort_coll`);
    const rows = keys.map((key, index) => ({ id: randomUUID(), name: `r${index}`, sort_order: key }));
    if (rows.length) await db.insert(SortTable).values([...rows].reverse());
    return rows;
  };
  const allRows = async (): Promise<Row[]> =>
    (await db.select().from(SortTable).orderBy(asc(SortTable.id))) as Row[];
  /** 鍵の順（バイト順、null は最後）で並べた名前 */
  const namesInKeyOrder = (rows: Row[]) =>
    [...rows]
      .sort((a, b) => {
        if (a.sort_order === b.sort_order) return a.id < b.id ? -1 : 1;
        if (a.sort_order === null) return 1;
        if (b.sort_order === null) return -1;
        return byteLess(a.sort_order, b.sort_order) ? -1 : 1;
      })
      .map((row) => row.name);

  test("前提: 列の照合順序のままの ORDER BY は鍵の順にならない", async (t) => {
    if (!needsNonC(t)) return;
    t.diagnostic(`collation: ${nonCCollation}`);
    const rows = await seed(KEYS);
    const plain = (await db.select().from(SortTable).orderBy(asc(SortTable.sort_order))) as Row[];
    assert.notDeepEqual(plain.map((row) => row.name), rows.map((row) => row.name));
  });

  test("読み出し: search（並べ替え画面の指定・ASC・DESC）・searchWithDeleted・list・searchForSorting は鍵の順。値は変わらない", async (t) => {
    if (!needsNonC(t)) return;
    const rows = await seed(KEYS);
    const expected = rows.map((row) => row.name);
    const before = await allRows();

    const names = (result: { results: Row[] } | Row[]) =>
      (Array.isArray(result) ? result : result.results).map((row) => row.name);
    assert.deepEqual(names(await sorted.search({ orderBy: [["sort_order", "ASC", "LAST"]], limit: 100 })), expected);
    assert.deepEqual(names(await sorted.search({ orderBy: [["sort_order", "ASC"]], limit: 100 })), expected);
    assert.deepEqual(names(await sorted.search({ orderBy: [["sort_order", "DESC"]], limit: 100 })), [...expected].reverse());
    assert.deepEqual(names(await sorted.searchWithDeleted({ orderBy: [["sort_order", "ASC", "LAST"]], limit: 100 })), expected);
    assert.deepEqual(names(await sorted.list()), expected);
    assert.deepEqual(names(await sorted.listWithDeleted()), expected);
    assert.deepEqual(names(await sorted.searchForSorting({ orderBy: [["sort_order", "ASC", "LAST"]], limit: 100 })), expected);
    // 2 ページ目も鍵の順で続く（36 件目以降の大文字小文字の境目をまたぐ）
    const page2 = await sorted.search({ orderBy: [["sort_order", "ASC", "LAST"]], limit: 30, page: 2 });
    assert.deepEqual(names(page2), expected.slice(30));

    assert.deepEqual(await allRows(), before);
  });

  test("create の採番（先頭に足す）は鍵の順で最小の前", async (t) => {
    if (!needsNonC(t)) return;
    // C の最小は "Zz"、列の照合順序の最小は "a0"（直す前は "a0" の前 = "Zz" と同じ鍵を作っていた）
    await seed(["Zz", "a0"]);
    const created = await sorted.create({ name: "new" });
    assert.ok(byteLess(created.sort_order, "Zz"), `${created.sort_order} < Zz`);
    const first = (await sorted.search({ orderBy: [["sort_order", "ASC", "LAST"]], limit: 1 })).results[0];
    assert.equal(first.id, created.id);
  });

  test("reorder: 先頭へ・ある行の後ろへ（gt の比較）・末尾へ", async (t) => {
    if (!needsNonC(t)) return;
    const rows = await seed(KEYS);
    const byKey = (key: string) => rows.find((row) => row.sort_order === key)!;
    const order = async () => (await sorted.search({ orderBy: [["sort_order", "ASC", "LAST"]], limit: 100 })).results.map((row: Row) => row.name);

    const toTop = await sorted.reorder(byKey("a5").id, null);
    assert.ok(byteLess(toTop.sort_order, "a0"));
    assert.equal((await order())[0], byKey("a5").name);

    // "aZ" の後ろ = "aZ" と "aa" の間（列の照合順序の gt では "aZ" より後ろの最初の行が別の行になる）
    const moved = byKey("a3");
    const afterUpper = await sorted.reorder(moved.id, byKey("aZ").id);
    assert.ok(byteLess("aZ", afterUpper.sort_order) && byteLess(afterUpper.sort_order, "aa"), afterUpper.sort_order);
    const current = await order();
    assert.equal(current[current.indexOf(byKey("aZ").name) + 1], moved.name);

    const toEnd = await sorted.reorder(byKey("a0").id, byKey("ad").id);
    assert.ok(byteLess("ad", toEnd.sort_order));
    assert.equal((await order()).at(-1), byKey("a0").name);
  });

  test("initializeSortOrder / searchForSorting の NULL の初期化は、鍵の順で最大の後ろに足す", async (t) => {
    if (!needsNonC(t)) return;
    // C の最大は "a0"、列の照合順序の最大は "Zz"（直す前は "Zz" の後ろ = "a0" と同じ鍵を作り得た）
    const rows = await seed(["a0", "Zz", null, null]);
    const keyMap = await sorted.initializeSortOrder([rows[2].id]);
    assert.ok(byteLess("a0", keyMap.get(rows[2].id)!));

    const result = await sorted.searchForSorting({ orderBy: [["sort_order", "ASC", "LAST"]], limit: 10 });
    const after = await allRows();
    const keys = after.map((row) => row.sort_order as string);
    assert.equal(new Set(keys).size, keys.length, "鍵が重ならない");
    assert.ok(keys.every((key) => key !== null));
    const last = after.find((row) => row.id === rows[3].id)!;
    assert.ok(byteLess(keyMap.get(rows[2].id)!, last.sort_order));
    assert.equal(result.results.length, 4);
  });

  test("replaceByQuery({ sortOrderFromIndex }) で 40 件を入れると、配列順 = 鍵の順で読める", async (t) => {
    if (!needsNonC(t)) return;
    await seed([]);
    const records = Array.from({ length: 40 }, (_, index) => ({ id: randomUUID(), name: `x${index}` }));
    await sorted.replaceByQuery({ field: "name", op: "like", value: "x%" }, records, { sortOrderFromIndex: true });
    const result = await sorted.search({ orderBy: [["sort_order", "ASC", "LAST"]], limit: 100 });
    assert.deepEqual(result.results.map((row: Row) => row.name), records.map((row) => row.name));
    assert.deepEqual(namesInKeyOrder(await allRows()), records.map((row) => row.name));
  });

  test("fractionalSort/server.ts の calculateNewSortOrder・calculateLastSortOrder も鍵の順", async (t) => {
    if (!needsNonC(t)) return;
    const rows = await seed(KEYS);
    const byKey = (key: string) => rows.find((row) => row.sort_order === key)!;
    const top = await server.calculateNewSortOrder(SortTable, SortTable.sort_order, SortTable.id, byKey("a3").id, null);
    assert.ok(byteLess(top, "a0"));
    const between = await server.calculateNewSortOrder(SortTable, SortTable.sort_order, SortTable.id, byKey("a3").id, byKey("aZ").id);
    assert.ok(byteLess("aZ", between) && byteLess(between, "aa"), between);
    const last = await server.calculateLastSortOrder(SortTable, SortTable.sort_order);
    assert.ok(byteLess("ad", last));

    await seed(["a0", "Zz"]);
    assert.ok(byteLess("a0", await server.calculateLastSortOrder(SortTable, SortTable.sort_order)));
  });

  test("integer の並びの列・並びの列の無いサービスは今のまま（COLLATE を付けない）", async () => {
    const intService = createCrudService(IntSortTable as never, {
      idType: "uuid",
      sortOrderColumn: IntSortTable.sort_order,
      defaultOrderBy: [["sort_order", "ASC"]],
    }) as any;
    const noSort = createCrudService(IntSortTable as never, { idType: "uuid", defaultOrderBy: [["sort_order", "DESC"]] }) as any;
    await db.execute(sql`delete from test_crud_sort_int`);
    await db.insert(IntSortTable).values([
      { id: randomUUID(), name: "two", sort_order: 2 },
      { id: randomUUID(), name: "ten", sort_order: 10 },
      { id: randomUUID(), name: "one", sort_order: 1 },
    ]);
    assert.deepEqual((await intService.list()).map((row: Row) => row.name), ["one", "two", "ten"]);
    assert.deepEqual(
      (await intService.search({ orderBy: [["sort_order", "DESC", "LAST"]] })).results.map((row: Row) => row.name),
      ["ten", "two", "one"],
    );
    assert.deepEqual((await noSort.list()).map((row: Row) => row.name), ["ten", "two", "one"]);

    const render = (spec: any, options?: any) =>
      db.select().from(IntSortTable).orderBy(...buildOrderBy(IntSortTable, spec, options)).toSQL().sql;
    const spec = [["sort_order", "ASC", "LAST"], ["name", "DESC"]];
    assert.equal(render(spec, { sortKeyColumn: IntSortTable.sort_order }), render(spec));
    assert.doesNotMatch(render(spec, { sortKeyColumn: IntSortTable.sort_order }), /collate/i);
    // text の並びの列を名指しする指定だけに付く（ほかの列には付かない）
    const textSql = db
      .select()
      .from(SortTable)
      .orderBy(...buildOrderBy(SortTable, [["sort_order", "ASC", "LAST"], ["name", "ASC"]], { sortKeyColumn: SortTable.sort_order }))
      .toSQL().sql;
    assert.match(textSql, /"sort_order" collate "C" ASC NULLS LAST, "test_crud_sort_coll"\."name" asc|"sort_order" collate "C" ASC NULLS LAST, "name" asc/);
  });
});
