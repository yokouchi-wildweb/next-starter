// src/lib/crud/collections/collections.db.test.ts
// createCrudService の collections オプション（ドメイン集約の差分同期）の実 DB テスト。
// 開発 DB に専用の表 test_crud_coll_parents / test_crud_coll_items を作り、終了時に DROP する（それ以外には書かない）。
// DATABASE_URL が無ければ全件 skip。
// 実行: pnpm test:crud-collections-db

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";
import { asc, eq, sql } from "drizzle-orm";
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

const envFile = resolve(process.cwd(), process.env.APP_ENV ?? ".env.development");
if (existsSync(envFile)) loadEnv({ path: envFile, quiet: true });

const skip = (process.env.DATABASE_URL ?? "").trim().length === 0;

const ParentTable = pgTable("test_crud_coll_parents", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
});

const ItemTable = pgTable("test_crud_coll_items", {
  id: uuid("id").primaryKey(),
  parentId: uuid("parent_id").notNull(),
  ref: text("ref").notNull(),
  caption: text("caption"),
  sort: integer("sort"),
});

const SoftItemTable = pgTable("test_crud_coll_soft_items", {
  id: uuid("id").primaryKey(),
  parentId: uuid("parent_id").notNull(),
  ref: text("ref").notNull(),
  sort: integer("sort"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

type Row = Record<string, any>;

describe("collections オプション（実 DB の TX）", { skip }, () => {
  // 遅延 import（DATABASE_URL を読んでから @/lib/drizzle を初期化する）
  let db: typeof import("@/lib/drizzle").db;
  let createCrudService: typeof import("@/lib/crud/drizzle").createCrudService;
  let syncCollection: typeof import("@/lib/crud/drizzle").syncCollection;
  let child: any;
  let parent: any;
  let plain: any;
  let itemsCollection: any;

  before(async () => {
    ({ db } = await import("@/lib/drizzle"));
    ({ createCrudService, syncCollection } = await import("@/lib/crud/drizzle"));

    child = createCrudService(ItemTable as never, { idType: "uuid", systemColumns: ["sort"] });
    itemsCollection = {
      fieldName: "items",
      service: () => child,
      parentColumn: ItemTable.parentId,
      refColumn: ItemTable.ref,
      sortColumn: ItemTable.sort,
      maxItems: 3,
    };
    parent = createCrudService(ParentTable as never, { idType: "uuid", collections: [itemsCollection] });
    plain = createCrudService(ParentTable as never, { idType: "uuid" });

    await db.execute(sql`drop table if exists test_crud_coll_items`);
    await db.execute(sql`drop table if exists test_crud_coll_parents`);
    await db.execute(sql`create table test_crud_coll_parents (id uuid primary key, name text not null)`);
    await db.execute(sql`
      create table test_crud_coll_items (
        id uuid primary key,
        parent_id uuid not null references test_crud_coll_parents(id) on delete cascade,
        ref text not null,
        caption text,
        sort integer
      )
    `);
  });

  after(async () => {
    if (!db) return;
    await db.execute(sql`drop table if exists test_crud_coll_items`);
    await db.execute(sql`drop table if exists test_crud_coll_parents`);
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

  test("create: 配列順に従属を作り、並びは 0 から振る。戻り値に ref の配列を載せる", async () => {
    const created = await parent.create({ name: "p1", items: ["a", "b", "c"] });
    assert.deepEqual(created.items, ["a", "b", "c"]);
    const rows = await childrenOf(created.id);
    assert.deepEqual(rows.map((row) => [row.ref, row.sort]), [["a", 0], ["b", 1], ["c", 2]]);
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
    assert.deepEqual(rows.map((row) => [row.ref, row.sort]), [["c", 0], ["d", 1], ["a", 2]]);
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
    await child.create({ parentId: created.id, ref: "d", sort: 3 });
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
    assert.deepEqual(result.rows.map((row) => [row.ref, row.sort]), [["b", 0], ["c", 1], ["a", 2]]);

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
    assert.deepEqual(Object.keys(plain).sort(), Object.keys(parent).sort());
    const created = await plain.create({ name: "plain", items: ["a"] });
    assert.equal(created.items, undefined);
    assert.deepEqual(await refsOf(created.id), []);
    const updated = await plain.update(created.id, { name: "plain2", items: ["a"] });
    assert.equal(updated.name, "plain2");
    await plain.bulkUpdateByIds([created.id], { name: "plain3", items: ["a"] });
    assert.equal((await parentRow(created.id)).name, "plain3");
    assert.deepEqual(await refsOf(created.id), []);
  });

  test("宣言の誤りはサービス生成時に throw する", () => {
    assert.throws(
      () =>
        createCrudService(ParentTable as never, {
          collections: [{ ...itemsCollection, parentColumn: SoftItemTable.parentId, refColumn: SoftItemTable.ref, sortColumn: SoftItemTable.sort }],
        }),
      /soft-delete/,
    );
    assert.throws(
      () => createCrudService(ParentTable as never, { collections: [{ ...itemsCollection, refColumn: SoftItemTable.ref }] }),
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
});
