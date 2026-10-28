// src/lib/crud/collections/collectionEntries.db.test.ts
// 集まりのエントリ（従属の行 id 付き）の読み出しと、値 → 従属の行 id の解決の実 DB テスト。
// 開発 DB に専用の表 test_crud_ent_* を作り、終了時に DROP する（それ以外には書かない）。DATABASE_URL が無ければ全件 skip。
// 実行: pnpm test:crud-collections-db

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

import { config as loadEnv } from "dotenv";
import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

const envFile = resolve(process.cwd(), process.env.APP_ENV ?? ".env.development");
if (existsSync(envFile)) loadEnv({ path: envFile, quiet: true });

const skip = (process.env.DATABASE_URL ?? "").trim().length === 0;

const ParentTable = pgTable("test_crud_ent_parents", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
const ItemTable = pgTable("test_crud_ent_items", {
  id: uuid("id").primaryKey(),
  parent_id: uuid("parent_id").notNull(),
  ref: text("ref").notNull(),
  sort: text("sort"),
});
// 値の列を秘匿列にした従属（エントリの value は null になる）
const SecretItemTable = pgTable("test_crud_ent_secret_items", {
  id: uuid("id").primaryKey(),
  parent_id: uuid("parent_id").notNull(),
  token: text("token").notNull(),
  sort: text("sort"),
});

type Row = Record<string, any>;

describe("集まりのエントリと値 → 従属の行 id の解決（実 DB）", { skip }, () => {
  let db: typeof import("@/lib/drizzle").db;
  let crud: typeof import("@/lib/crud/drizzle");
  let collection: any;
  let secretCollection: any;
  const parents = { a: randomUUID(), b: randomUUID(), empty: randomUUID(), deleted: randomUUID() };
  const itemIds: Record<string, string> = {};

  const dropTables = async () => {
    for (const name of ["test_crud_ent_items", "test_crud_ent_secret_items", "test_crud_ent_parents"]) {
      await db.execute(sql`drop table if exists ${sql.identifier(name)}`);
    }
  };

  before(async () => {
    ({ db } = await import("@/lib/drizzle"));
    crud = await import("@/lib/crud/drizzle");
    const { defineHiddenColumns } = await import("@/lib/crud/drizzle/hiddenColumns");
    defineHiddenColumns(SecretItemTable, ["token"]);

    await dropTables();
    await db.execute(sql`create table test_crud_ent_parents (id uuid primary key, name text not null, deleted_at timestamptz)`);
    await db.execute(sql`
      create table test_crud_ent_items (id uuid primary key, parent_id uuid not null references test_crud_ent_parents(id) on delete cascade, ref text not null, sort text)
    `);
    await db.execute(sql`
      create table test_crud_ent_secret_items (id uuid primary key, parent_id uuid not null references test_crud_ent_parents(id) on delete cascade, token text not null, sort text)
    `);

    const child = crud.createCrudService(ItemTable as never, { idType: "uuid", systemColumns: ["sort"] });
    collection = { fieldName: "items", service: () => child, parentColumn: ItemTable.parent_id, valueColumn: ItemTable.ref, sortColumn: ItemTable.sort };
    secretCollection = { fieldName: "secrets", service: () => child, parentColumn: SecretItemTable.parent_id, valueColumn: SecretItemTable.token, sortColumn: SecretItemTable.sort };

    await db.insert(ParentTable).values([
      { id: parents.a, name: "a" },
      { id: parents.b, name: "b" },
      { id: parents.empty, name: "empty" },
      { id: parents.deleted, name: "deleted", deletedAt: new Date() },
    ]);
    // a: 並びの鍵は COLLATE "C"（"aB" < "aa"）、NULL は最後
    const rows = [
      ["a-null", parents.a, "n", null],
      ["a-aa", parents.a, "lower", "aa"],
      ["a-aB", parents.a, "upper", "aB"],
      ["a-a0", parents.a, "first", "a0"],
      ["b-a0", parents.b, "shared", "a0"],
      ["deleted-a0", parents.deleted, "gone", "a0"],
    ] as const;
    for (const [key, parent_id, ref, sort] of rows) {
      itemIds[key] = randomUUID();
      await db.insert(ItemTable).values({ id: itemIds[key], parent_id, ref, sort });
    }
    await db.insert(SecretItemTable).values({ id: randomUUID(), parent_id: parents.a, token: "secret", sort: "a0" });
  });

  after(async () => {
    if (!db) return;
    await dropTables();
    await (db as unknown as { $client?: { end: () => Promise<void> } }).$client?.end();
  });

  test("1 つの主: { id, value, sort } を読み出しと同じ並び（並びの列 ASC NULLS LAST、text は COLLATE \"C\"）で返す", async () => {
    const entries = await crud.collectionEntries({ collection, parentId: parents.a });
    assert.deepEqual(
      entries.map((entry) => [entry.id, entry.value, entry.sort]),
      [
        [itemIds["a-a0"], "first", "a0"],
        [itemIds["a-aB"], "upper", "aB"],
        [itemIds["a-aa"], "lower", "aa"],
        [itemIds["a-null"], "n", null],
      ],
    );
    assert.deepEqual(await crud.collectionEntries({ collection, parentId: parents.empty }), []);
  });

  test("複数の主: 1 クエリで主の id ごとに返し、従属の無い主は []。主の表を渡すと論理削除された主は []", async () => {
    const original = db.select;
    let selects = 0;
    (db as any).select = (...args: unknown[]) => {
      selects += 1;
      return (original as any).apply(db, args);
    };
    let entries;
    try {
      entries = await crud.collectionEntriesForParents({ collection, parentTable: ParentTable as never, parentIds: [parents.a, parents.b, parents.empty, parents.deleted] });
    } finally {
      (db as any).select = original;
    }
    assert.equal(selects, 1);
    assert.equal(entries.get(parents.a)!.length, 4);
    assert.deepEqual(entries.get(parents.b)!.map((entry) => entry.id), [itemIds["b-a0"]]);
    assert.deepEqual(entries.get(parents.empty), []);
    assert.deepEqual(entries.get(parents.deleted), [], "論理削除された主");
    const withoutParentTable = await crud.collectionEntriesForParents({ collection, parentIds: [parents.deleted] });
    assert.equal(withoutParentTable.get(parents.deleted)!.length, 1, "主の表を渡さなければ絞らない");
  });

  test("従属が値の列を秘匿列にしていれば value は null（id と並びは返す）", async () => {
    const [entry] = await crud.collectionEntries({ collection: secretCollection, parentId: parents.a });
    assert.equal(entry.value, null);
    assert.equal(entry.sort, "a0");
    assert.ok(entry.id);
  });

  test("解決: その主の集まりの値なら従属の行 id、無い値・他の主の値は null（複数形は Map）", async () => {
    assert.equal(await crud.resolveCollectionEntryId({ collection, parentId: parents.a, value: "upper" }), itemIds["a-aB"]);
    assert.equal(await crud.resolveCollectionEntryId({ collection, parentId: parents.a, value: "missing" }), null);
    assert.equal(await crud.resolveCollectionEntryId({ collection, parentId: parents.a, value: "shared" }), null, "他の主の値");
    const map = await crud.resolveCollectionEntryIds({ collection, parentId: parents.a, values: ["first", "shared", "lower", "first"] });
    assert.deepEqual([...map].sort(), [["first", itemIds["a-a0"]], ["lower", itemIds["a-aa"]]].sort());
  });

  test("解決: 呼び出し元の tx の中で使える（同じ tx で作った行が見え、巻き戻せば消える）", async () => {
    const newId = randomUUID();
    await assert.rejects(
      db.transaction(async (tx) => {
        await tx.insert(ItemTable).values({ id: newId, parent_id: parents.b, ref: "in-tx", sort: "a1" });
        assert.equal(await crud.resolveCollectionEntryId({ collection, parentId: parents.b, value: "in-tx" }, tx), newId);
        throw new Error("rollback");
      }),
      /rollback/,
    );
    assert.equal(await crud.resolveCollectionEntryId({ collection, parentId: parents.b, value: "in-tx" }), null);
  });

  test("主のサービス: collectionEntries / collectionEntriesForParents（論理削除された主は []、知らない項目は 404）", async () => {
    const parentService = crud.createCrudService(ParentTable as never, { idType: "uuid", useSoftDelete: true, collections: [collection] } as never) as any;
    assert.equal((await parentService.collectionEntries("items", parents.a)).length, 4);
    const many = await parentService.collectionEntriesForParents("items", [parents.b, parents.deleted]);
    assert.deepEqual(Object.keys(many).sort(), [parents.b, parents.deleted].sort());
    assert.equal(many[parents.b].length, 1);
    assert.deepEqual(many[parents.deleted], []);
    await assert.rejects(parentService.collectionEntries("nope", parents.a), (error: Row) => error?.status === 404);
  });
});
