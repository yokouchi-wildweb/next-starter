// src/lib/crud/collections/collections.db.test.ts
// createCrudService の collections オプション（ドメイン集約の差分同期）の実 DB テスト。
// 開発 DB に専用の表 test_crud_coll_*（主・従属・読み出し用・照合順序用）を作り、終了時に DROP する（それ以外には書かない）。
// 複製のケースは fake のストレージポートとテスト用の binding を使う（features には依存しない）。
// C 以外の照合順序のケースは、DB にその照合順序（ICU / glibc の en_US）が無ければ明示して飛ばす。
// DATABASE_URL が無ければ全件 skip。
// 実行: pnpm test:crud-collections-db

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";
import { randomUUID } from "node:crypto";
import { asc, eq, isNull, sql } from "drizzle-orm";
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { generateInitialSortKeys } from "@/lib/crud/drizzle/fractionalSort";
import type { CrudStorageBinding } from "@/lib/crud/storageIntegration/types";

const envFile = resolve(process.cwd(), process.env.APP_ENV ?? ".env.development");
if (existsSync(envFile)) loadEnv({ path: envFile, quiet: true });

const skip = (process.env.DATABASE_URL ?? "").trim().length === 0;

const ParentTable = pgTable("test_crud_coll_parents", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
});

// 並びの列はテンプレート（sample の sort_order）と同じ text
const ItemTable = pgTable("test_crud_coll_items", {
  id: uuid("id").primaryKey(),
  parentId: uuid("parent_id").notNull(),
  ref: text("ref").notNull(),
  caption: text("caption"),
  sort: text("sort"),
});

const IntItemTable = pgTable("test_crud_coll_int_items", {
  id: uuid("id").primaryKey(),
  parentId: uuid("parent_id").notNull(),
  ref: text("ref").notNull(),
  sort: integer("sort"),
});

const BadSortItemTable = pgTable("test_crud_coll_bad_items", {
  id: uuid("id").primaryKey(),
  parentId: uuid("parent_id").notNull(),
  ref: text("ref").notNull(),
  sort: timestamp("sort", { withTimezone: true }),
});

const SoftItemTable = pgTable("test_crud_coll_soft_items", {
  id: uuid("id").primaryKey(),
  parentId: uuid("parent_id").notNull(),
  ref: text("ref").notNull(),
  sort: integer("sort"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// 読み出しの射影・先頭 1 件の SQL 用（論理削除と並べ替えの列を持つ主）
const ReadParentTable = pgTable("test_crud_coll_read_parents", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  // searchForSorting は列の DB 名をフィールド名に使うので、キーを DB 名と揃える
  sort_order: text("sort_order"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

const ReadItemTable = pgTable("test_crud_coll_read_items", {
  id: uuid("id").primaryKey(),
  parentId: uuid("parent_id").notNull(),
  ref: text("ref").notNull(),
  caption: text("caption"),
  sort: text("sort"),
});

// 並びの列を C 以外の照合順序で宣言する従属（create table で collate を付ける）
const CollItemTable = pgTable("test_crud_coll_collate_items", {
  id: uuid("id").primaryKey(),
  parentId: uuid("parent_id").notNull(),
  ref: text("ref").notNull(),
  sort: text("sort"),
});

// 複製用: 主（ファイルの列あり）・ファイルの集まり（ref がファイル）・ファイルでない集まり（integer の並び）
const DupParentTable = pgTable("test_crud_coll_dup_parents", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  photo: text("photo"),
});

const DupMediaTable = pgTable("test_crud_coll_dup_media", {
  id: uuid("id").primaryKey(),
  parentId: uuid("parent_id").notNull(),
  ref: text("ref").notNull(),
  caption: text("caption"),
  sort: text("sort"),
});

const DupTagTable = pgTable("test_crud_coll_dup_tags", {
  id: uuid("id").primaryKey(),
  parentId: uuid("parent_id").notNull(),
  ref: text("ref").notNull(),
  sort: integer("sort"),
});

// C と順序が変わる照合順序の候補（大文字小文字を一次で区別しない）
const NON_C_COLLATIONS = ["en-US-x-icu", "und-x-icu", "en_US.utf8", "en_US.UTF-8"];

type Row = Record<string, any>;

// lib の fractional の鍵（replaceByQuery の sortOrderFromIndex と同じ生成）
const keys = (count: number): string[] => generateInitialSortKeys(count);

describe("collections オプション（実 DB の TX）", { skip }, () => {
  // 遅延 import（DATABASE_URL を読んでから @/lib/drizzle を初期化する）
  let db: typeof import("@/lib/drizzle").db;
  let createCrudService: typeof import("@/lib/crud/drizzle").createCrudService;
  let syncCollection: typeof import("@/lib/crud/drizzle").syncCollection;
  let firstInCollection: typeof import("@/lib/crud/drizzle").firstInCollection;
  let firstInCollectionForAlias: typeof import("@/lib/crud/drizzle").firstInCollectionForAlias;
  let duplicateWithCollections: typeof import("@/lib/crud/drizzle").duplicateWithCollections;
  let child: any;
  let parent: any;
  let plain: any;
  let itemsCollection: any;
  let nonCCollation: string | undefined;

  const dropTables = async () => {
    for (const name of [
      "test_crud_coll_items",
      "test_crud_coll_int_items",
      "test_crud_coll_parents",
      "test_crud_coll_collate_items",
      "test_crud_coll_read_items",
      "test_crud_coll_read_parents",
      "test_crud_coll_dup_media",
      "test_crud_coll_dup_tags",
      "test_crud_coll_dup_parents",
    ]) {
      await db.execute(sql`drop table if exists ${sql.identifier(name)}`);
    }
  };

  before(async () => {
    ({ db } = await import("@/lib/drizzle"));
    ({ createCrudService, syncCollection, firstInCollection, firstInCollectionForAlias, duplicateWithCollections } = await import(
      "@/lib/crud/drizzle"
    ));

    child = createCrudService(ItemTable as never, { idType: "uuid", systemColumns: ["sort"] });
    itemsCollection = {
      fieldName: "items",
      service: () => child,
      parentColumn: ItemTable.parentId,
      valueColumn: ItemTable.ref,
      sortColumn: ItemTable.sort,
      maxItems: 3,
    };
    parent = createCrudService(ParentTable as never, { idType: "uuid", collections: [itemsCollection] });
    plain = createCrudService(ParentTable as never, { idType: "uuid" });

    await dropTables();
    await db.execute(sql`create table test_crud_coll_parents (id uuid primary key, name text not null)`);
    await db.execute(sql`
      create table test_crud_coll_items (
        id uuid primary key,
        parent_id uuid not null references test_crud_coll_parents(id) on delete cascade,
        ref text not null,
        caption text,
        sort text
      )
    `);
    await db.execute(sql`
      create table test_crud_coll_int_items (
        id uuid primary key,
        parent_id uuid not null references test_crud_coll_parents(id) on delete cascade,
        ref text not null,
        sort integer
      )
    `);
    await db.execute(sql`
      create table test_crud_coll_read_parents (id uuid primary key, name text not null, sort_order text, deleted_at timestamptz)
    `);
    await db.execute(sql`
      create table test_crud_coll_read_items (
        id uuid primary key,
        parent_id uuid not null references test_crud_coll_read_parents(id) on delete cascade,
        ref text not null,
        caption text,
        sort text
      )
    `);
    await db.execute(sql`create table test_crud_coll_dup_parents (id uuid primary key, name text not null, photo text)`);
    await db.execute(sql`
      create table test_crud_coll_dup_media (
        id uuid primary key,
        parent_id uuid not null references test_crud_coll_dup_parents(id) on delete cascade,
        ref text not null,
        caption text,
        sort text
      )
    `);
    await db.execute(sql`
      create table test_crud_coll_dup_tags (
        id uuid primary key,
        parent_id uuid not null references test_crud_coll_dup_parents(id) on delete cascade,
        ref text not null,
        sort integer
      )
    `);
    const found = (await db.execute(sql`
      select collname from pg_collation where collname in (${sql.join(NON_C_COLLATIONS.map((name) => sql`${name}`), sql`, `)})
    `)) as unknown as Row[];
    nonCCollation = NON_C_COLLATIONS.find((name) => found.some((row) => row.collname === name));
    if (nonCCollation) {
      await db.execute(sql`
        create table test_crud_coll_collate_items (
          id uuid primary key,
          parent_id uuid not null references test_crud_coll_read_parents(id) on delete cascade,
          ref text not null,
          sort text collate ${sql.identifier(nonCCollation)}
        )
      `);
    }
  });

  after(async () => {
    if (!db) return;
    await dropTables();
    await (db as unknown as { $client?: { end: () => Promise<void> } }).$client?.end();
  });

  const childrenOf = async (parentId: string): Promise<Row[]> =>
    (await db
      .select()
      .from(ItemTable)
      .where(eq(ItemTable.parentId, parentId))
      .orderBy(asc(ItemTable.sort), asc(ItemTable.id))) as Row[];
  const refsOf = async (parentId: string) => (await childrenOf(parentId)).map((row) => row.ref);
  const parentRow = async (id: string) =>
    ((await db.select().from(ParentTable).where(eq(ParentTable.id, id))) as Row[])[0];
  const parentCount = async () => ((await db.select().from(ParentTable)) as Row[]).length;
  const rejects400 = (promise: Promise<unknown>) =>
    assert.rejects(promise, (error: any) => error?.name === "DomainError" && error.status === 400);

  test("create: 配列順に従属を作り、並びは fractional の鍵で振る。戻り値に値の配列を載せる", async () => {
    const created = await parent.create({ name: "p1", items: ["a", "b", "c"] });
    assert.deepEqual(created.items, ["a", "b", "c"]);
    const rows = await childrenOf(created.id);
    assert.deepEqual(rows.map((row) => [row.ref, row.sort]), [["a", keys(3)[0]], ["b", keys(3)[1]], ["c", keys(3)[2]]]);
  });

  test("create: 従属の作成が失敗すれば主の行も残らない（同じ TX）", async () => {
    const failing = createCrudService(ParentTable as never, {
      idType: "uuid",
      collections: [{ ...itemsCollection, service: () => ({ ...child, create: async () => { throw new Error("child down"); } }) }],
    });
    const before = await parentCount();
    await assert.rejects(failing.create({ name: "fail", items: ["x"] } as never), /child down/);
    assert.equal(await parentCount(), before);
  });

  test("update: 変わらない値の行は id を保ち、消えた値は消し、新しい値は作り、並びは配列順", async () => {
    const created = await parent.create({ name: "p2", items: ["a", "b", "c"] });
    const beforeRows = await childrenOf(created.id);
    const idOf = (ref: string) => beforeRows.find((row) => row.ref === ref)?.id;

    const updated = await parent.update(created.id, { name: "p2x", items: ["c", "d", "a"] });
    assert.equal(updated.name, "p2x");
    assert.deepEqual(updated.items, ["c", "d", "a"]);
    const rows = await childrenOf(created.id);
    assert.deepEqual(rows.map((row) => [row.ref, row.sort]), [["c", keys(3)[0]], ["d", keys(3)[1]], ["a", keys(3)[2]]]);
    assert.equal(rows[0].id, idOf("c"));
    assert.equal(rows[2].id, idOf("a"));
    assert.ok(!rows.some((row) => row.id === idOf("b")));
  });

  test("update: 集まりだけの更新も同期する", async () => {
    const created = await parent.create({ name: "p3", items: ["a"] });
    await parent.update(created.id, { items: ["b", "a"] });
    assert.deepEqual(await refsOf(created.id), ["b", "a"]);
  });

  test("upsert: 新規でも衝突の更新でも差分同期する", async () => {
    const inserted = await parent.upsert({ name: "u1", items: ["a", "b"] });
    assert.deepEqual(await refsOf(inserted.id), ["a", "b"]);
    const keptId = (await childrenOf(inserted.id)).find((row) => row.ref === "b")!.id;

    const upserted = await parent.upsert({ id: inserted.id, name: "u1x", items: ["b", "c"] });
    assert.equal(upserted.id, inserted.id);
    assert.equal((await parentRow(inserted.id)).name, "u1x");
    const rows = await childrenOf(inserted.id);
    assert.deepEqual(rows.map((row) => row.ref), ["b", "c"]);
    assert.equal(rows[0].id, keptId);
  });

  test("項目の省略 = 維持、[] = 全部消す", async () => {
    const created = await parent.create({ name: "p4", items: ["a", "b"] });
    await parent.update(created.id, { name: "p4x" });
    await parent.update(created.id, { name: "p4y", items: undefined });
    assert.deepEqual(await refsOf(created.id), ["a", "b"]);
    await parent.update(created.id, { items: [] });
    assert.deepEqual(await refsOf(created.id), []);
  });

  test("重複・最大件数の超過・配列でない値は 400 で、DB は変わらない", async () => {
    const created = await parent.create({ name: "p5", items: ["a"] });
    const count = await parentCount();
    await rejects400(parent.create({ name: "dup", items: ["x", "x"] }));
    await rejects400(parent.create({ name: "over", items: ["1", "2", "3", "4"] }));
    await rejects400(parent.update(created.id, { name: "changed", items: ["a", "a"] }));
    await rejects400(parent.update(created.id, { name: "changed", items: ["1", "2", "3", "4"] }));
    await rejects400(parent.update(created.id, { name: "changed", items: null }));
    await rejects400(parent.upsert({ id: created.id, name: "changed", items: ["b", "b"] }));
    assert.equal(await parentCount(), count);
    assert.equal((await parentRow(created.id)).name, "p5");
    assert.deepEqual(await refsOf(created.id), ["a"]);
  });

  test("最大件数を超えた既存の行は黙って消さない: そのまま保存すると 400、省略なら残る", async () => {
    const created = await parent.create({ name: "p6", items: ["a", "b", "c"] });
    // 従属の API からの直接の書き込みで上限を超える
    await child.create({ parentId: created.id, ref: "d", sort: "z0" });
    await rejects400(parent.update(created.id, { items: ["a", "b", "c", "d"] }));
    await parent.update(created.id, { name: "p6x" });
    assert.deepEqual(await refsOf(created.id), ["a", "b", "c", "d"]);
    // 読んだ一覧から減らして保存すれば通る
    await parent.update(created.id, { items: ["d", "a"] });
    assert.deepEqual(await refsOf(created.id), ["d", "a"]);
  });

  test("bulk 系と replaceByQuery は集まりの値があれば DB を変える前に 400、無ければ今のまま", async () => {
    const created = await parent.create({ name: "bulk", items: ["a"] });
    const where = { field: "id", op: "eq", value: created.id } as const;
    await rejects400(parent.bulkUpsert([{ id: created.id, name: "x", items: ["b"] }]));
    await rejects400(parent.bulkUpdate([{ id: created.id, data: { name: "x", items: ["b"] } }]));
    await rejects400(parent.bulkUpdateByIds([created.id], { name: "x", items: [] }));
    await rejects400(parent.bulkUpdateByQuery(where, { name: "x", items: ["b"] }));
    await rejects400(parent.replaceByQuery(where, [{ name: "x", items: ["b"] }]));
    assert.equal((await parentRow(created.id)).name, "bulk");
    assert.deepEqual(await refsOf(created.id), ["a"]);

    await parent.bulkUpdateByIds([created.id], { name: "b1" });
    assert.equal((await parentRow(created.id)).name, "b1");
    await parent.bulkUpdateByQuery(where, { name: "b2" });
    assert.equal((await parentRow(created.id)).name, "b2");
    await parent.bulkUpdate([{ id: created.id, data: { name: "b3" } }]);
    assert.equal((await parentRow(created.id)).name, "b3");
    await parent.bulkUpsert([{ id: created.id, name: "b4" }]);
    assert.equal((await parentRow(created.id)).name, "b4");
    assert.deepEqual(await refsOf(created.id), ["a"]);

    const other = await plain.create({ name: "replace-me" });
    const replaced = await parent.replaceByQuery({ field: "id", op: "eq", value: other.id }, [{ id: other.id, name: "replaced" }]);
    assert.equal(replaced[0].name, "replaced");
  });

  test("単独の syncCollection はサービスの経路と同じ結果になる", async () => {
    const viaService = await parent.create({ name: "s1", items: ["a", "b"] });
    await parent.update(viaService.id, { items: ["b", "c", "a"] });

    const direct = await plain.create({ name: "s2" });
    await syncCollection({ parentTable: ParentTable as never, parentId: direct.id, collection: itemsCollection, values: ["a", "b"] });
    const result = await syncCollection({
      parentTable: ParentTable as never,
      parentId: direct.id,
      collection: itemsCollection,
      values: ["b", "c", "a"],
    });
    assert.equal(result.created, 1);
    assert.equal(result.deleted, 0);
    assert.deepEqual(result.rows.map((row) => [row.ref, row.sort]), [["b", keys(3)[0]], ["c", keys(3)[1]], ["a", keys(3)[2]]]);

    const shape = async (id: string) => (await childrenOf(id)).map((row) => [row.ref, row.sort]);
    assert.deepEqual(await shape(direct.id), await shape(viaService.id));

    await assert.rejects(
      syncCollection({ parentTable: ParentTable as never, parentId: direct.id, collection: itemsCollection, values: ["a", "a"] }),
      (error: any) => error?.status === 400,
    );
    await assert.rejects(
      syncCollection({
        parentTable: ParentTable as never,
        parentId: "00000000-0000-0000-0000-000000000000",
        collection: itemsCollection,
        values: [],
      }),
      (error: any) => error?.status === 404,
    );
  });

  test("従属の systemColumns に並びの列が無ければ、最初の同期で分かるエラーにして主も残さない", async () => {
    const noSystem = createCrudService(ItemTable as never, { idType: "uuid" });
    const misconfigured = createCrudService(ParentTable as never, {
      idType: "uuid",
      collections: [{ ...itemsCollection, service: () => noSystem }],
    });
    const before = await parentCount();
    await assert.rejects(misconfigured.create({ name: "nosys", items: ["a"] } as never), /systemColumns に並びの列 "sort"/);
    assert.equal(await parentCount(), before);
  });

  test("オプションの無いサービスは今のまま（集まりの項目を扱わない）", async () => {
    // 集まりのあるサービスが足すのは読み取り専用の collectionFields だけ（オプションの無いサービスには無い）
    assert.deepEqual(Object.keys(parent).sort(), [...Object.keys(plain), "collectionFields"].sort());
    assert.deepEqual(parent.collectionFields, ["items"]);
    assert.equal(plain.collectionFields, undefined);
    const created = await plain.create({ name: "plain", items: ["a"] });
    assert.equal(created.items, undefined);
    assert.deepEqual(await refsOf(created.id), []);
    const updated = await plain.update(created.id, { name: "plain2", items: ["a"] });
    assert.equal(updated.name, "plain2");
    await plain.bulkUpdateByIds([created.id], { name: "plain3", items: ["a"] });
    assert.equal((await parentRow(created.id)).name, "plain3");
    assert.deepEqual(await refsOf(created.id), []);
  });

  test("text の並びの列で 12 件の作成・並べ替え・一部削除の後も、並びの列の昇順が配列順になる", async () => {
    const big = createCrudService(ParentTable as never, {
      idType: "uuid",
      collections: [{ ...itemsCollection, maxItems: undefined }],
    });
    const refs = Array.from({ length: 12 }, (_, index) => `r${index}`);
    const created = await big.create({ name: "big", items: refs } as never);
    assert.deepEqual(await refsOf(created.id), refs);

    const reordered = [...refs].reverse();
    reordered.splice(3, 0, reordered.splice(10, 1)[0]);
    await big.update(created.id, { items: reordered } as never);
    assert.deepEqual(await refsOf(created.id), reordered);

    const trimmed = reordered.filter((_, index) => index % 3 !== 1).concat(["n0", "n1"]);
    await big.update(created.id, { items: trimmed } as never);
    assert.deepEqual(await refsOf(created.id), trimmed);
    // 文字列の昇順で読んだ並びの値は、振り直した鍵そのもの
    assert.deepEqual((await childrenOf(created.id)).map((row) => row.sort), keys(trimmed.length));
  });

  test("integer の並びの列は 0 始まりの添字で振る", async () => {
    const intChild = createCrudService(IntItemTable as never, { idType: "uuid", systemColumns: ["sort"] });
    const intParent = createCrudService(ParentTable as never, {
      idType: "uuid",
      collections: [
        {
          fieldName: "items",
          service: () => intChild,
          parentColumn: IntItemTable.parentId,
          valueColumn: IntItemTable.ref,
          sortColumn: IntItemTable.sort,
        },
      ],
    });
    const intRows = async (id: string) =>
      (await db
        .select()
        .from(IntItemTable)
        .where(eq(IntItemTable.parentId, id))
        .orderBy(asc(IntItemTable.sort), asc(IntItemTable.id))) as Row[];
    const refs = Array.from({ length: 12 }, (_, index) => `i${index}`);
    const created = await intParent.create({ name: "int", items: refs } as never);
    const reordered = [...refs].reverse().slice(1);
    await intParent.update(created.id, { items: reordered } as never);
    const rows = await intRows(created.id);
    assert.deepEqual(rows.map((row) => row.ref), reordered);
    assert.deepEqual(rows.map((row) => row.sort), reordered.map((_, index) => index));
  });

  test("宣言の誤りはサービス生成時に throw する", () => {
    assert.throws(
      () =>
        createCrudService(ParentTable as never, {
          collections: [
            { ...itemsCollection, parentColumn: BadSortItemTable.parentId, valueColumn: BadSortItemTable.ref, sortColumn: BadSortItemTable.sort },
          ],
        }),
      /text \(fractional key\) or integer/,
    );
    assert.throws(
      () =>
        createCrudService(ParentTable as never, {
          collections: [{ ...itemsCollection, parentColumn: SoftItemTable.parentId, valueColumn: SoftItemTable.ref, sortColumn: SoftItemTable.sort }],
        }),
      /soft-delete/,
    );
    assert.throws(
      () => createCrudService(ParentTable as never, { collections: [{ ...itemsCollection, valueColumn: SoftItemTable.ref }] }),
      /same child table/,
    );
    assert.throws(
      () => createCrudService(ParentTable as never, { collections: [{ ...itemsCollection, fieldName: "name" }] }),
      /fieldName/,
    );
    assert.throws(
      () => createCrudService(ParentTable as never, { collections: [{ ...itemsCollection, maxItems: 0 }] }),
      /maxItems/,
    );
  });

  // ---- 読み出しの射影・先頭 1 件の SQL ----

  type ReadFixture = {
    readParent: any;
    readPlain: any;
    readItems: any;
    order: Row; // 並びの NULL・同値を含む主
    big: Row; // 従属が DEFAULT_HAS_MANY_LIMIT（100）を超える主
    empty: Row; // 従属の無い主
    deleted: Row; // 論理削除した主
    orderRefs: string[];
    bigRefs: string[];
  };
  let readFixture: ReadFixture | undefined;

  const setupRead = async (): Promise<ReadFixture> => {
    if (readFixture) return readFixture;
    const readChild = createCrudService(ReadItemTable as never, { idType: "uuid", systemColumns: ["sort"] });
    const readItems = {
      fieldName: "items",
      service: () => readChild,
      parentColumn: ReadItemTable.parentId,
      valueColumn: ReadItemTable.ref,
      sortColumn: ReadItemTable.sort,
    };
    const options = {
      idType: "uuid",
      useSoftDelete: true,
      sortOrderColumn: ReadParentTable.sort_order,
      defaultOrderBy: [["name", "ASC"]],
    } as const;
    const readParent = createCrudService(ReadParentTable as never, { ...options, collections: [readItems] } as never) as any;
    const readPlain = createCrudService(ReadParentTable as never, options as never) as any;

    const big = await readPlain.create({ name: "a-big" });
    const order = await readPlain.create({ name: "b-order" });
    const empty = await readPlain.create({ name: "c-empty" });

    // 並び: NULL は最後、同じ値は id の昇順（id は昇順に並べた uuid を割り当てる）
    const ids = Array.from({ length: 5 }, () => randomUUID()).sort();
    await db.insert(ReadItemTable).values([
      { id: ids[0], parentId: order.id, ref: "n1", caption: "cap-n1", sort: null },
      { id: ids[4], parentId: order.id, ref: "n0", caption: "cap-n0", sort: null },
      { id: ids[1], parentId: order.id, ref: "t2", caption: "cap-t2", sort: "a1" },
      { id: ids[2], parentId: order.id, ref: "t1", caption: "cap-t1", sort: "a1" },
      { id: ids[3], parentId: order.id, ref: "f", caption: "cap-f", sort: "a0" },
    ]);
    const bigRefs = Array.from({ length: 105 }, (_, index) => `b${index}`);
    const bigKeys = keys(bigRefs.length);
    await db.insert(ReadItemTable).values(
      bigRefs.map((ref, index) => ({ id: randomUUID(), parentId: big.id, ref, sort: bigKeys[index] })).reverse(),
    );

    const deleted = await readParent.create({ name: "d-deleted", items: ["x", "y"] });
    await readParent.remove(deleted.id);

    readFixture = {
      readParent,
      readPlain,
      readItems,
      order,
      big,
      empty,
      deleted,
      orderRefs: ["f", "t2", "t1", "n1", "n0"],
      bigRefs,
    };
    return readFixture;
  };

  const itemsById = (rows: Row[]) => new Map(rows.map((row) => [row.id, row.items]));

  test("読み出しの 7 口は集まりを全件・並び順（NULL は最後、同値は id 順）の値の配列で載せ、従属が無ければ []", async () => {
    const f = await setupRead();
    assert.ok(f.bigRefs.length > 100, "DEFAULT_HAS_MANY_LIMIT（100）を超える件数");

    assert.deepEqual((await f.readParent.get(f.order.id)).items, f.orderRefs);
    assert.deepEqual((await f.readParent.get(f.big.id)).items, f.bigRefs);
    assert.deepEqual((await f.readParent.get(f.empty.id)).items, []);
    assert.equal(await f.readParent.get(f.deleted.id), undefined);

    assert.deepEqual((await f.readParent.getWithDeleted(f.deleted.id)).items, ["x", "y"]);
    assert.deepEqual((await f.readParent.getWithDeleted(f.big.id)).items, f.bigRefs);

    const listed = itemsById(await f.readParent.list());
    assert.deepEqual(listed.get(f.order.id), f.orderRefs);
    assert.deepEqual(listed.get(f.big.id), f.bigRefs);
    assert.deepEqual(listed.get(f.empty.id), []);
    assert.equal(listed.has(f.deleted.id), false);

    const listedAll = itemsById(await f.readParent.listWithDeleted());
    assert.deepEqual(listedAll.get(f.deleted.id), ["x", "y"]);
    assert.deepEqual(listedAll.get(f.big.id), f.bigRefs);

    // 主のページが小さくても、載せる従属は全件
    const page1 = await f.readParent.search({ limit: 2 });
    assert.deepEqual(page1.results.map((row: Row) => row.name), ["a-big", "b-order"]);
    assert.deepEqual(page1.results[0].items, f.bigRefs);
    assert.deepEqual(page1.results[1].items, f.orderRefs);
    const page2 = await f.readParent.search({ limit: 2, page: 2 });
    assert.deepEqual(page2.results.map((row: Row) => [row.name, row.items]), [["c-empty", []]]);

    const withDeleted = itemsById((await f.readParent.searchWithDeleted({ limit: 10 })).results);
    assert.deepEqual(withDeleted.get(f.deleted.id), ["x", "y"]);
    assert.deepEqual(withDeleted.get(f.order.id), f.orderRefs);

    const forSorting = itemsById((await f.readParent.searchForSorting({ limit: 10 })).results);
    assert.deepEqual(forSorting.get(f.big.id), f.bigRefs);
    assert.deepEqual(forSorting.get(f.empty.id), []);
    assert.equal(forSorting.has(f.deleted.id), false);
  });

  test("オプションの無いサービスの読み出しは今のまま（集まりの項目を載せない）", async () => {
    const f = await setupRead();
    const plainRow = await f.readPlain.get(f.order.id);
    const projected = await f.readParent.get(f.order.id);
    assert.equal("items" in plainRow, false);
    assert.deepEqual(Object.keys(plainRow).sort(), Object.keys(projected).filter((key) => key !== "items").sort());
    for (const row of await f.readPlain.list()) assert.equal("items" in row, false);
    for (const row of (await f.readPlain.search({ limit: 10 })).results) assert.equal("items" in row, false);
    assert.equal("items" in (await f.readPlain.getWithDeleted(f.deleted.id)), false);
  });

  test("先頭 1 件の SQL（列オブジェクトの形）: select / where / orderBy / COALESCE で使え、空なら NULL", async () => {
    const f = await setupRead();
    const P = ReadParentTable;
    const first = () => firstInCollection(f.readItems, P.id);

    const rows = (await db
      .select({
        id: P.id,
        first: first(),
        caption: firstInCollection(f.readItems, P.id, { select: ReadItemTable.caption }),
        label: sql`coalesce(${first()}, 'none')`,
      })
      .from(P)
      .where(sql`${P.id} in (${sql.join([f.order.id, f.big.id, f.empty.id, f.deleted.id].map((id) => sql`${id}::uuid`), sql`, `)})`)
      .orderBy(sql`${first()} asc nulls last`, P.id)) as Row[];
    assert.deepEqual(
      rows.map((row) => [row.id, row.first, row.caption, row.label]),
      [
        [f.big.id, "b0", null, "b0"],
        [f.order.id, "f", "cap-f", "f"],
        [f.deleted.id, "x", null, "x"],
        [f.empty.id, null, null, "none"],
      ],
    );

    const none = (await db.select({ id: P.id }).from(P).where(isNull(first()))) as Row[];
    assert.deepEqual(none.map((row) => row.id), [f.empty.id]);
    const matched = (await db.select({ id: P.id }).from(P).where(eq(first(), "f"))) as Row[];
    assert.deepEqual(matched.map((row) => row.id), [f.order.id]);

    assert.throws(() => firstInCollection(f.readItems, P.id, { select: ItemTable.ref }), /select must be a column of the child table/);
  });

  test("先頭 1 件の SQL（別名の文字列の形）: 手書きの sql`` の select / where / orderBy / COALESCE で使える", async () => {
    const f = await setupRead();
    const first = () => firstInCollectionForAlias(f.readItems, "p");
    const ids = [f.order.id, f.big.id, f.empty.id, f.deleted.id].map((id) => sql`${id}::uuid`);
    const rows = (await db.execute(sql`
      select p.id, ${first()} as first,
        coalesce(${firstInCollectionForAlias(f.readItems, "p", { select: ReadItemTable.caption })}, 'none') as caption
      from test_crud_coll_read_parents p
      where p.id in (${sql.join(ids, sql`, `)}) and ${first()} is not null
      order by ${first()} desc, p.id
    `)) as unknown as Row[];
    assert.deepEqual(
      rows.map((row) => [row.id, row.first, row.caption]),
      [
        [f.deleted.id, "x", "none"],
        [f.order.id, "f", "cap-f"],
        [f.big.id, "b0", "none"],
      ],
    );
    const none = (await db.execute(sql`
      select p.id from test_crud_coll_read_parents p
      where p.id in (${sql.join(ids, sql`, `)}) and coalesce(${first()}, '') = ''
    `)) as unknown as Row[];
    assert.deepEqual(none.map((row) => row.id), [f.empty.id]);
  });

  test("並びの列が C 以外の照合順序でも、射影・先頭 1 件の SQL（2 形）・同期の全件読みは鍵の順（COLLATE \"C\"）", async (t) => {
    if (!nonCCollation) {
      const message = `skipped: no non-C collation (${NON_C_COLLATIONS.join(", ")}) in this DB`;
      console.log(message);
      t.skip(message);
      return;
    }
    console.log(`non-C collation case RAN with collation "${nonCCollation}"`);
    t.diagnostic(`collation: ${nonCCollation}`);
    const f = await setupRead();
    const collChild = createCrudService(CollItemTable as never, { idType: "uuid", systemColumns: ["sort"] });
    const collItems = {
      fieldName: "items",
      service: () => collChild,
      parentColumn: CollItemTable.parentId,
      valueColumn: CollItemTable.ref,
      sortColumn: CollItemTable.sort,
    };
    const collParent = createCrudService(ReadParentTable as never, {
      idType: "uuid",
      useSoftDelete: true,
      collections: [collItems],
    } as never) as any;
    const collRows = async (parentId: string) =>
      (await db.select().from(CollItemTable).where(eq(CollItemTable.parentId, parentId))) as Row[];

    // 40 件（a0..a9 aA..aZ aa..ad: 大文字と小文字が混ざる）を逆順に入れる
    const refs = Array.from({ length: 40 }, (_, index) => `c${index}`);
    const sortKeys = keys(refs.length);
    assert.equal(sortKeys[35], "aZ");
    assert.equal(sortKeys[36], "aa");
    const target = await f.readPlain.create({ name: "e-collate" });
    await db.insert(CollItemTable).values(
      refs.map((ref, index) => ({ id: randomUUID(), parentId: target.id, ref, sort: sortKeys[index] })).reverse(),
    );

    // 前提: 列の照合順序のままの ORDER BY は鍵の順にならない（このケースに意味がある）
    const collated = (await db
      .select({ ref: CollItemTable.ref })
      .from(CollItemTable)
      .where(eq(CollItemTable.parentId, target.id))
      .orderBy(asc(CollItemTable.sort), asc(CollItemTable.id))) as Row[];
    assert.notDeepEqual(collated.map((row) => row.ref), refs);

    // 射影
    assert.deepEqual((await collParent.get(target.id)).items, refs);
    const searched = await collParent.search({ where: { field: "id", op: "eq", value: target.id } });
    assert.deepEqual(searched.results[0].items, refs);

    // 先頭 1 件の SQL: "aZ" と "aa" だけの主 → C の順では "aZ" が先
    const pair = await f.readPlain.create({ name: "f-collate-first" });
    await db.insert(CollItemTable).values([
      { id: randomUUID(), parentId: pair.id, ref: "lower", sort: "aa" },
      { id: randomUUID(), parentId: pair.id, ref: "upper", sort: "aZ" },
    ]);
    const P = ReadParentTable;
    const columnForm = (await db
      .select({ id: P.id, first: firstInCollection(collItems, P.id) })
      .from(P)
      .where(sql`${P.id} in (${sql`${pair.id}::uuid`}, ${sql`${target.id}::uuid`})`)
      .orderBy(P.name)) as Row[];
    assert.deepEqual(columnForm.map((row) => row.first), ["c0", "upper"]);
    const aliasForm = (await db.execute(sql`
      select p.id, ${firstInCollectionForAlias(collItems, "p")} as first from test_crud_coll_read_parents p
      where p.id in (${pair.id}::uuid, ${target.id}::uuid) order by p.name
    `)) as unknown as Row[];
    assert.deepEqual(aliasForm.map((row) => row.first), ["c0", "upper"]);
    assert.deepEqual((await collParent.get(pair.id)).items, ["upper", "lower"]);

    // 同期の全件読み: 同じ ref の行が 2 つあれば「並びの先」の 1 行を残す。
    // c35（"aZ"）の複製を "aa" で入れる → C の順では元の行が先なので、元の行が残る
    const original = (await collRows(target.id)).find((row) => row.ref === "c35")!;
    const duplicateId = randomUUID();
    await db.insert(CollItemTable).values({ id: duplicateId, parentId: target.id, ref: "c35", sort: "aa" });
    const result = await syncCollection({ parentTable: ReadParentTable as never, parentId: target.id, collection: collItems, values: refs });
    assert.equal(result.deleted, 1);
    const remaining = (await collRows(target.id)).filter((row) => row.ref === "c35");
    assert.deepEqual(remaining.map((row) => row.id), [original.id]);
    assert.deepEqual(result.rows.map((row) => row.ref), refs);
    assert.deepEqual((await collParent.get(target.id)).items, refs);
  });

  // ---- 複製（2 段: 従属のファイルを TX の外で写す → 主と従属を 1 TX で作る） ----
  // ストレージは fake ポート、binding はテスト用（複製は fake の copy、紐付けは Map に記録）

  type TestBinding = CrudStorageBinding & { bound: Map<string, unknown> };
  let fake: import("@/lib/storage/server/fake").FakeStoragePort;
  let copyCalls = 0;
  let failCopyAt = 0; // n 回目の copy を失敗させる（0 = 失敗させない）

  const locationOf = (ref: string) => ({ bucket: "test-bucket", path: ref });
  const uploadRef = async (label: string): Promise<string> => {
    const ref = `fake://${label}/${randomUUID()}`;
    await fake.put(locationOf(ref), new Uint8Array(1), { contentType: "image/png", cacheControl: "test" } as never);
    return ref;
  };
  const testBinding = (field: string, label: string): TestBinding => {
    const bound = new Map<string, unknown>();
    return {
      bound,
      fields: [{ name: field, purpose: `testColl.${label}` }],
      async afterWrite(_tx, before, after) {
        const value = after[field];
        if (typeof value === "string" && value !== before?.[field]) bound.set(value, after.id);
        return null;
      },
      async afterHardDelete() {
        return null;
      },
      async duplicateValues(source) {
        const value = source[field];
        if (typeof value !== "string") return {};
        copyCalls += 1;
        if (copyCalls === failCopyAt) throw new Error("copy failed");
        const copied = `fake://${label}/${randomUUID()}`;
        await fake.copy(locationOf(value), locationOf(copied), { cacheControl: "test" } as never);
        return { [field]: copied };
      },
      async afterCommit() {},
    };
  };

  type DupFixture = {
    parentBinding: TestBinding;
    mediaBinding: TestBinding;
    mediaChild: any;
    tagChild: any;
    gallery: any;
    tags: any;
    dupParent: any;
  };
  let dupFixture: DupFixture | undefined;

  const setupDup = async (): Promise<DupFixture> => {
    if (dupFixture) return dupFixture;
    const { createFakeStoragePort } = await import("@/lib/storage/server/fake");
    fake = createFakeStoragePort();
    const parentBinding = testBinding("photo", "parent");
    const mediaBinding = testBinding("ref", "media");
    const mediaChild = createCrudService(DupMediaTable as never, {
      idType: "uuid",
      systemColumns: ["sort"],
      storage: mediaBinding,
    });
    const tagChild = createCrudService(DupTagTable as never, { idType: "uuid", systemColumns: ["sort"] });
    const gallery = {
      fieldName: "gallery",
      service: () => mediaChild,
      parentColumn: DupMediaTable.parentId,
      valueColumn: DupMediaTable.ref,
      sortColumn: DupMediaTable.sort,
    };
    const tags = {
      fieldName: "tags",
      service: () => tagChild,
      parentColumn: DupTagTable.parentId,
      valueColumn: DupTagTable.ref,
      sortColumn: DupTagTable.sort,
    };
    const dupParent = createCrudService(DupParentTable as never, {
      idType: "uuid",
      storage: parentBinding,
      collections: [gallery, tags],
    });
    dupFixture = { parentBinding, mediaBinding, mediaChild, tagChild, gallery, tags, dupParent };
    return dupFixture;
  };

  const mediaRows = async (parentId: string) =>
    (await db
      .select()
      .from(DupMediaTable)
      .where(eq(DupMediaTable.parentId, parentId))
      .orderBy(asc(DupMediaTable.sort), asc(DupMediaTable.id))) as Row[];
  const tagRows = async (parentId: string) =>
    (await db
      .select()
      .from(DupTagTable)
      .where(eq(DupTagTable.parentId, parentId))
      .orderBy(asc(DupTagTable.sort), asc(DupTagTable.id))) as Row[];
  const countOf = async (name: string) =>
    Number(((await db.execute(sql`select count(*)::int as n from ${sql.identifier(name)}`)) as unknown as Row[])[0].n);
  const dupCounts = async () => ({
    parents: await countOf("test_crud_coll_dup_parents"),
    media: await countOf("test_crud_coll_dup_media"),
    tags: await countOf("test_crud_coll_dup_tags"),
  });

  /** 主のファイル・ファイルの集まり 3 件（2 件目に caption）・ファイルでない集まり 2 件を持つ複製元 */
  const createDupSource = async (f: DupFixture) => {
    const photo = await uploadRef("parent");
    const refs = [await uploadRef("media"), await uploadRef("media"), await uploadRef("media")];
    const source = await f.dupParent.create({ name: "src", photo, gallery: refs, tags: ["t1", "t2"] });
    await db.update(DupMediaTable).set({ caption: "second" }).where(eq(DupMediaTable.ref, refs[1]));
    return { source, photo, refs };
  };

  test("複製: 従属のファイルを新しい ref に写し、主と従属を作る（主のファイルは主の binding、並びは振り直し）", async () => {
    const f = await setupDup();
    const { source, photo, refs } = await createDupSource(f);
    const sourceMedia = await mediaRows(source.id);

    const copy = await f.dupParent.duplicate(source.id);
    assert.equal(copy.name, "src_コピー");
    // 主のファイルは主の binding で写して紐付く
    assert.notEqual(copy.photo, photo);
    assert.equal(f.parentBinding.bound.get(copy.photo), copy.id);
    assert.equal(fake.objects.has(`test-bucket/${copy.photo}`), true);

    // ファイルの集まり: 新しい ref（元の ref を使わない）・複製元の並び順・新しい従属に紐付く
    const copiedMedia = await mediaRows(copy.id);
    assert.equal(copiedMedia.length, 3);
    assert.deepEqual(copy.gallery, copiedMedia.map((row) => row.ref));
    for (const row of copiedMedia) {
      assert.equal(refs.includes(row.ref), false);
      assert.equal(f.mediaBinding.bound.get(row.ref), row.id);
      assert.equal(fake.objects.has(`test-bucket/${row.ref}`), true);
    }
    assert.deepEqual(copiedMedia.map((row) => row.caption), [null, "second", null]);
    assert.deepEqual(copiedMedia.map((row) => row.sort), keys(3));

    // ファイルでない集まり（binding なし）は値をそのまま、integer の並びは添字
    assert.deepEqual(copy.tags, ["t1", "t2"]);
    assert.deepEqual((await tagRows(copy.id)).map((row) => [row.ref, row.sort]), [["t1", 0], ["t2", 1]]);

    // 複製元はそのまま
    assert.deepEqual(await mediaRows(source.id), sourceMedia);
    assert.equal(f.mediaBinding.bound.get(refs[0]), sourceMedia[0].id);
    assert.deepEqual((await tagRows(source.id)).map((row) => row.ref), ["t1", "t2"]);
  });

  test("複製: 従属が 0 件なら集まりは空、対応表も空", async () => {
    const f = await setupDup();
    const source = await f.dupParent.create({ name: "none" });
    const { record, idMaps } = await f.dupParent.duplicateWithIdMap(source.id);
    assert.deepEqual(record.gallery, []);
    assert.deepEqual(record.tags, []);
    assert.equal(idMaps.gallery.size, 0);
    assert.equal(idMaps.tags.size, 0);
    assert.deepEqual(await mediaRows(record.id), []);
  });

  test("複製: 宣言の duplicate: false の集まりは写さない（複製元の従属はそのまま）", async () => {
    const f = await setupDup();
    const { source } = await createDupSource(f);
    const off = createCrudService(DupParentTable as never, {
      idType: "uuid",
      storage: f.parentBinding,
      collections: [{ ...f.gallery, duplicate: false }, f.tags],
    }) as any;
    const before = await mediaRows(source.id);
    const copy = await off.duplicate(source.id);
    assert.deepEqual(copy.gallery, []);
    assert.deepEqual(await mediaRows(copy.id), []);
    assert.deepEqual(copy.tags, ["t1", "t2"]);
    assert.deepEqual(await mediaRows(source.id), before);
  });

  test("duplicateWithIdMap: 集まりごとに複製元の従属の id → 複製した従属の id を返す。duplicate は主の行だけ", async () => {
    const f = await setupDup();
    const { source } = await createDupSource(f);
    const { record, idMaps } = await f.dupParent.duplicateWithIdMap(source.id);
    const sourceMedia = await mediaRows(source.id);
    const copiedMedia = await mediaRows(record.id);
    assert.deepEqual(
      [...idMaps.gallery.entries()],
      sourceMedia.map((row, index) => [row.id, copiedMedia[index].id]),
    );
    const sourceTags = await tagRows(source.id);
    const copiedTags = await tagRows(record.id);
    assert.deepEqual([...idMaps.tags.entries()], sourceTags.map((row, index) => [row.id, copiedTags[index].id]));

    const plainCopy = await f.dupParent.duplicate(source.id);
    assert.equal("idMaps" in plainCopy, false);
    assert.equal(plainCopy.gallery.length, 3);
  });

  test("複製: 1 段目（ファイルの複製）が失敗すれば throw し、主も従属も書かない", async () => {
    const f = await setupDup();
    const { source } = await createDupSource(f);
    const before = await dupCounts();
    copyCalls = 0;
    failCopyAt = 3; // 主 → 従属 1 件目 → 従属 2 件目で失敗
    try {
      await assert.rejects(f.dupParent.duplicate(source.id), /copy failed/);
    } finally {
      failCopyAt = 0;
    }
    assert.deepEqual(await dupCounts(), before);
  });

  test("複製: 2 段目（行の作成）が失敗すれば TX ごと巻き戻り、主も従属も残らない", async () => {
    const f = await setupDup();
    const { source } = await createDupSource(f);
    let creates = 0;
    const failing = createCrudService(DupParentTable as never, {
      idType: "uuid",
      storage: f.parentBinding,
      collections: [
        f.gallery,
        {
          ...f.tags,
          service: () => ({
            ...f.tagChild,
            create: async (data: unknown, tx: unknown) => {
              creates += 1;
              if (creates === 2) throw new Error("child down");
              return f.tagChild.create(data, tx);
            },
          }),
        },
      ],
    }) as any;
    const before = await dupCounts();
    await assert.rejects(failing.duplicate(source.id), /child down/);
    assert.deepEqual(await dupCounts(), before);
  });

  test("単独の duplicateWithCollections は base の duplicate なしで同じ結果になり、主の create に集まりの配列を渡さない", async () => {
    const f = await setupDup();
    const { source } = await createDupSource(f);
    const inputs: Row[] = [];
    const handWritten = {
      get: (id: string) => f.dupParent.get(id),
      create: async (data: Row, tx?: unknown) => {
        inputs.push(data);
        return f.dupParent.create(data, tx);
      },
      duplicateStorageValues: f.dupParent.duplicateStorageValues,
    };
    const direct = await duplicateWithCollections({ service: handWritten, collections: [f.gallery, f.tags], id: source.id });
    assert.equal(inputs.length, 1);
    assert.equal("gallery" in inputs[0], false);
    assert.equal("tags" in inputs[0], false);

    const viaService = await f.dupParent.duplicateWithIdMap(source.id);
    const shape = async (result: { record: Row; idMaps: Record<string, Map<unknown, unknown>> }) => ({
      name: result.record.name,
      tags: result.record.tags,
      galleryCount: result.record.gallery.length,
      captions: (await mediaRows(result.record.id as string)).map((row) => row.caption),
      mapSizes: Object.fromEntries(Object.entries(result.idMaps).map(([key, map]) => [key, map.size])),
    });
    assert.deepEqual(await shape(direct as never), await shape(viaService));
  });

  test("集まりの無いサービスの複製は今のまま（storage だけ・オプションなし）、duplicateWithIdMap の対応表は空", async () => {
    const f = await setupDup();
    const photo = await uploadRef("parent");
    const storageOnly = createCrudService(DupParentTable as never, { idType: "uuid", storage: f.parentBinding }) as any;
    const source = await storageOnly.create({ name: "storage-only", photo });
    const copy = await storageOnly.duplicate(source.id);
    assert.notEqual(copy.photo, photo);
    assert.equal(f.parentBinding.bound.get(copy.photo), copy.id);
    assert.equal("gallery" in copy, false);
    const mapped = await storageOnly.duplicateWithIdMap(source.id);
    assert.deepEqual(mapped.idMaps, {});
    assert.notEqual(mapped.record.photo, photo);

    const none = createCrudService(DupParentTable as never, { idType: "uuid" }) as any;
    const plainSource = await none.create({ name: "plain", photo: "as-is" });
    const plainCopy = await none.duplicate(plainSource.id, { name: "renamed" });
    assert.equal(plainCopy.name, "renamed");
    assert.equal(plainCopy.photo, "as-is");
    assert.equal("gallery" in plainCopy, false);
    assert.deepEqual((await none.duplicateWithIdMap(plainSource.id)).idMaps, {});
  });
});
