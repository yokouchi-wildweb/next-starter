// src/lib/crud/collections/collectionsEmbed.db.test.ts
// 他ドメインの withRelations で埋め込まれた主の行に、主の集まりが載るかの実 DB テスト（belongsTo / hasMany / belongsToMany・深さ 2）。
// 開発 DB に専用の表 test_crud_emb_* を作り、終了時に DROP する（それ以外には書かない）。DATABASE_URL が無ければ全件 skip。
// 主のサービスは作らない（表の登録 defineTableCollections だけで、主のサービスを読まない画面と同じ条件にする）。
// 実行: pnpm test:crud-collections-db

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

import { config as loadEnv } from "dotenv";
import { sql } from "drizzle-orm";
import { pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";

const envFile = resolve(process.cwd(), process.env.APP_ENV ?? ".env.development");
if (existsSync(envFile)) loadEnv({ path: envFile, quiet: true });

const skip = (process.env.DATABASE_URL ?? "").trim().length === 0;

const GroupTable = pgTable("test_crud_emb_groups", { id: uuid("id").primaryKey(), name: text("name").notNull() });
// 集まりを持つ主
const OwnerTable = pgTable("test_crud_emb_owners", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  group_id: uuid("group_id"),
});
const OwnerItemTable = pgTable("test_crud_emb_owner_items", {
  id: uuid("id").primaryKey(),
  owner_id: uuid("owner_id").notNull(),
  ref: text("ref").notNull(),
  sort: text("sort"),
});
// 主を belongsTo で指す表と、それを指す表（深さ 2）
const RefTable = pgTable("test_crud_emb_refs", { id: uuid("id").primaryKey(), owner_id: uuid("owner_id") });
const NoteTable = pgTable("test_crud_emb_notes", { id: uuid("id").primaryKey(), ref_id: uuid("ref_id") });
// 主を belongsToMany で持つ表
const TagTable = pgTable("test_crud_emb_tags", { id: uuid("id").primaryKey(), name: text("name").notNull() });
const TagOwnerTable = pgTable(
  "test_crud_emb_tag_owners",
  { tag_id: uuid("tag_id").notNull(), owner_id: uuid("owner_id").notNull() },
  (table) => [primaryKey({ columns: [table.tag_id, table.owner_id] })],
);
// 集まりの無い主（クエリ数の比較用）
const PlainTable = pgTable("test_crud_emb_plains", { id: uuid("id").primaryKey(), name: text("name").notNull() });
const PlainRefTable = pgTable("test_crud_emb_plain_refs", { id: uuid("id").primaryKey(), plain_id: uuid("plain_id") });

type Row = Record<string, any>;

describe("集まりを持つ主の、他ドメインの withRelations での埋め込み（実 DB）", { skip }, () => {
  let db: typeof import("@/lib/drizzle").db;
  let createCrudService: typeof import("@/lib/crud/drizzle").createCrudService;
  let syncCollection: typeof import("@/lib/crud/drizzle").syncCollection;
  let defineTableCollections: typeof import("@/lib/crud/collections/tableCollections").defineTableCollections;
  let ownerCollection: any;
  let loaderCalls = 0;
  const ids = { group: randomUUID(), owners: [randomUUID(), randomUUID(), randomUUID()], tag: randomUUID() };

  const TABLES = [
    "test_crud_emb_notes", "test_crud_emb_refs", "test_crud_emb_tag_owners", "test_crud_emb_tags",
    "test_crud_emb_owner_items", "test_crud_emb_owners", "test_crud_emb_groups", "test_crud_emb_plain_refs", "test_crud_emb_plains",
  ];
  const dropTables = async () => {
    for (const name of TABLES) await db.execute(sql`drop table if exists ${sql.identifier(name)}`);
  };

  before(async () => {
    ({ db } = await import("@/lib/drizzle"));
    ({ createCrudService, syncCollection } = await import("@/lib/crud/drizzle"));
    ({ defineTableCollections } = await import("@/lib/crud/collections/tableCollections"));

    await dropTables();
    await db.execute(sql`create table test_crud_emb_groups (id uuid primary key, name text not null)`);
    await db.execute(sql`create table test_crud_emb_owners (id uuid primary key, name text not null, group_id uuid references test_crud_emb_groups(id))`);
    await db.execute(sql`
      create table test_crud_emb_owner_items (
        id uuid primary key, owner_id uuid not null references test_crud_emb_owners(id) on delete cascade, ref text not null, sort text
      )
    `);
    await db.execute(sql`create table test_crud_emb_refs (id uuid primary key, owner_id uuid references test_crud_emb_owners(id))`);
    await db.execute(sql`create table test_crud_emb_notes (id uuid primary key, ref_id uuid references test_crud_emb_refs(id))`);
    await db.execute(sql`create table test_crud_emb_tags (id uuid primary key, name text not null)`);
    await db.execute(sql`create table test_crud_emb_tag_owners (tag_id uuid not null, owner_id uuid not null, primary key (tag_id, owner_id))`);
    await db.execute(sql`create table test_crud_emb_plains (id uuid primary key, name text not null)`);
    await db.execute(sql`create table test_crud_emb_plain_refs (id uuid primary key, plain_id uuid references test_crud_emb_plains(id))`);

    const itemChild = createCrudService(OwnerItemTable as never, { idType: "uuid", systemColumns: ["sort"] });
    ownerCollection = {
      fieldName: "items",
      service: () => itemChild,
      parentColumn: OwnerItemTable.owner_id,
      valueColumn: OwnerItemTable.ref,
      sortColumn: OwnerItemTable.sort,
    };
    // 生成の entities/drizzle.ts と同じ遅延の登録（主のサービスは作らない）
    defineTableCollections(OwnerTable, async () => {
      loaderCalls += 1;
      return [ownerCollection];
    });

    await db.insert(GroupTable).values({ id: ids.group, name: "g" });
    await db.insert(OwnerTable).values(ids.owners.map((id, i) => ({ id, name: `o${i}`, group_id: ids.group })));
    // owners[0] = [c, a, b]、owners[1] = [x]、owners[2] = 空
    await syncCollection({ parentTable: OwnerTable as never, parentId: ids.owners[0], collection: ownerCollection, values: ["c", "a", "b"] });
    await syncCollection({ parentTable: OwnerTable as never, parentId: ids.owners[1], collection: ownerCollection, values: ["x"] });
    await db.insert(TagTable).values({ id: ids.tag, name: "t" });
    await db.insert(TagOwnerTable).values(ids.owners.map((owner_id) => ({ tag_id: ids.tag, owner_id })));
  });

  after(async () => {
    if (!db) return;
    await dropTables();
    await (db as unknown as { $client?: { end: () => Promise<void> } }).$client?.end();
  });

  const belongsToOwner = { field: "owner", foreignKey: "owner_id", table: OwnerTable };
  const itemsOf = (owner: Row | null | undefined) => owner?.items;

  test("belongsTo: 埋め込んだ主の行に集まりを全件・並び順で載せ、従属が無ければ []。null の主はそのまま", async () => {
    const refs = createCrudService(RefTable as never, { idType: "uuid", belongsToRelations: [belongsToOwner] }) as any;
    const created = [
      await refs.create({ id: randomUUID(), owner_id: ids.owners[0] }),
      await refs.create({ id: randomUUID(), owner_id: ids.owners[0] }),
      await refs.create({ id: randomUUID(), owner_id: ids.owners[2] }),
      await refs.create({ id: randomUUID(), owner_id: null }),
    ];
    const byId = new Map<string, Row>();
    for (const row of (await refs.search({ withRelations: true, limit: 100 })).results) byId.set(row.id, row);
    assert.deepEqual(itemsOf(byId.get(created[0].id)!.owner), ["c", "a", "b"]);
    assert.deepEqual(itemsOf(byId.get(created[1].id)!.owner), ["c", "a", "b"]);
    assert.deepEqual(itemsOf(byId.get(created[2].id)!.owner), []);
    assert.equal(byId.get(created[3].id)!.owner, null);
    assert.deepEqual(itemsOf((await refs.get(created[0].id, { withRelations: true })).owner), ["c", "a", "b"]);
    assert.equal(loaderCalls, 1, "遅延の登録は最初の 1 回だけ読み込む");
  });

  test("hasMany: 子として埋め込んだ主の行それぞれに集まりを載せる", async () => {
    const groups = createCrudService(GroupTable as never, {
      idType: "uuid",
      hasManyRelations: [{ field: "owners", table: OwnerTable, foreignKey: "group_id" }],
    }) as any;
    const group = await groups.get(ids.group, { withRelations: true });
    const items = new Map<string, unknown>(group.owners.map((owner: Row) => [owner.id, owner.items]));
    assert.deepEqual(items.get(ids.owners[0]), ["c", "a", "b"]);
    assert.deepEqual(items.get(ids.owners[1]), ["x"]);
    assert.deepEqual(items.get(ids.owners[2]), []);
  });

  test("belongsToMany: 中間表越しに埋め込んだ主の行に集まりを載せる", async () => {
    const tags = createCrudService(TagTable as never, {
      idType: "uuid",
      belongsToManyObjectRelations: [
        { field: "owners", targetTable: OwnerTable, throughTable: TagOwnerTable, sourceColumn: TagOwnerTable.tag_id, targetColumn: TagOwnerTable.owner_id },
      ],
    }) as any;
    const tag = await tags.get(ids.tag, { withRelations: true });
    const items = new Map<string, unknown>(tag.owners.map((owner: Row) => [owner.id, owner.items]));
    assert.deepEqual(items.get(ids.owners[0]), ["c", "a", "b"]);
    assert.deepEqual(items.get(ids.owners[1]), ["x"]);
    assert.deepEqual(items.get(ids.owners[2]), []);
  });

  test("深さ 2: notes → refs → owners の 2 階層目の主にも載せる", async () => {
    const ref = await db.insert(RefTable).values({ id: randomUUID(), owner_id: ids.owners[1] }).returning();
    const notes = createCrudService(NoteTable as never, {
      idType: "uuid",
      belongsToRelations: [{ field: "ref", foreignKey: "ref_id", table: RefTable, nested: { belongsTo: [belongsToOwner] } }],
    }) as any;
    const note = await notes.create({ id: randomUUID(), ref_id: (ref[0] as Row).id });
    const loaded = await notes.get(note.id, { withRelations: 2 });
    assert.deepEqual(loaded.ref.owner.items, ["x"]);
    const shallow = await notes.get(note.id, { withRelations: 1 });
    assert.equal(shallow.ref.owner, undefined, "深さ 1 では 2 階層目を展開しない（今のまま）");
  });

  test("集まりの無い主の埋め込みはクエリが増えない。集まりを持つ主は集まり 1 つにつき 1 クエリ（行数に依らない）", async () => {
    const plainId = randomUUID();
    await db.insert(PlainTable).values({ id: plainId, name: "p" });
    const plainRefs = createCrudService(PlainRefTable as never, {
      idType: "uuid",
      belongsToRelations: [{ field: "plain", foreignKey: "plain_id", table: PlainTable }],
    }) as any;
    for (let i = 0; i < 3; i += 1) await plainRefs.create({ id: randomUUID(), plain_id: plainId });
    const refs = createCrudService(RefTable as never, { idType: "uuid", belongsToRelations: [belongsToOwner] }) as any;

    const countSelects = async (work: () => Promise<unknown>) => {
      const original = db.select;
      let calls = 0;
      (db as any).select = (...args: unknown[]) => {
        calls += 1;
        return (original as any).apply(db, args);
      };
      try {
        await work();
      } finally {
        (db as any).select = original;
      }
      return calls;
    };
    const plainBase = await countSelects(() => plainRefs.list({ limit: 100 }));
    const plainEmbed = await countSelects(() => plainRefs.list({ withRelations: true, limit: 100 }));
    assert.equal(plainEmbed - plainBase, 1, "集まりの無い主: リレーションの取得 1 本だけ");

    const ownerBase = await countSelects(() => refs.list({ limit: 100 }));
    const ownerEmbed = await countSelects(() => refs.list({ withRelations: true, limit: 100 }));
    assert.equal(ownerEmbed - ownerBase, 2, "集まりを持つ主: リレーションの取得 1 本 + 集まり 1 つにつき 1 本");
  });

  test("主のサービスを作ると、その表にも登録される（entities/drizzle.ts を手書きする主の経路）", async () => {
    const { hasTableCollections } = await import("@/lib/crud/collections/tableCollections");
    assert.equal(hasTableCollections(PlainTable), false);
    createCrudService(PlainTable as never, {
      idType: "uuid",
      collections: [{ ...ownerCollection, fieldName: "plain_items" }],
    });
    assert.equal(hasTableCollections(PlainTable), true);
  });
});
