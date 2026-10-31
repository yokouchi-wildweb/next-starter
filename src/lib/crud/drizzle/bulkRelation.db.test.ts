// src/lib/crud/drizzle/bulkRelation.db.test.ts
// bulkAddRelation / bulkRemoveRelation の実 DB テスト。
// 開発 DB に専用の表 test_crud_rel_*（本体・関連先・中間）を作り、終了時に DROP する（それ以外には書かない）。
// DATABASE_URL が無ければ全件 skip。
// 実行: pnpm test:crud-bulk-relation-db

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";
import { sql } from "drizzle-orm";
import { pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

const envFile = resolve(process.cwd(), process.env.APP_ENV ?? ".env.development");
if (existsSync(envFile)) loadEnv({ path: envFile, quiet: true });

const skip = (process.env.DATABASE_URL ?? "").trim().length === 0;

const OwnerTable = pgTable("test_crud_rel_owners", {
  id: uuid("id").primaryKey(),
  name: text("name"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

const TagTable = pgTable("test_crud_rel_tags", {
  id: uuid("id").primaryKey(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

const JoinTable = pgTable(
  "test_crud_rel_joins",
  {
    ownerId: uuid("owner_id").notNull().references(() => OwnerTable.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id").notNull().references(() => TagTable.id, { onDelete: "cascade" }),
  },
  (table) => ({ pk: primaryKey({ columns: [table.ownerId, table.tagId] }) }),
);

const status = (error: unknown) => (error as { status?: number }).status;

describe("bulkAddRelation / bulkRemoveRelation", { skip }, () => {
  let db: typeof import("@/lib/drizzle").db;
  let service: any;
  let audited: any[] = [];

  const drop = async () => {
    await db.execute(sql`DROP TABLE IF EXISTS test_crud_rel_joins`);
    await db.execute(sql`DROP TABLE IF EXISTS test_crud_rel_owners`);
    await db.execute(sql`DROP TABLE IF EXISTS test_crud_rel_tags`);
  };

  const buildService = async (bulkMode: "detail" | "aggregate") => {
    const { createCrudService } = await import("@/lib/crud/drizzle");
    return createCrudService(OwnerTable, {
      idType: "uuid",
      useSoftDelete: true,
      belongsToManyRelations: [
        {
          fieldName: "tag_ids",
          throughTable: JoinTable,
          sourceColumn: JoinTable.ownerId,
          targetColumn: JoinTable.tagId,
          sourceProperty: "ownerId",
          targetProperty: "tagId",
        },
      ],
      audit: {
        enabled: true,
        targetType: "owner",
        actionPrefix: "owner",
        bulkMode,
        recorder: {
          record: async (input: unknown) => {
            audited.push(input);
          },
          recordDiff: async () => {},
        },
      },
    } as any);
  };

  const owner = async (deleted = false) => {
    const id = randomUUID();
    await db.insert(OwnerTable).values({ id, deletedAt: deleted ? new Date() : null });
    return id;
  };
  const tag = async (deleted = false) => {
    const id = randomUUID();
    await db.insert(TagTable).values({ id, deletedAt: deleted ? new Date() : null });
    return id;
  };
  const tagsOf = async (ownerId: string) => {
    const rows = (await db.execute(
      sql`SELECT tag_id FROM test_crud_rel_joins WHERE owner_id = ${ownerId}`,
    )) as unknown as { tag_id: string }[];
    return rows.map((row) => row.tag_id).sort();
  };

  before(async () => {
    ({ db } = await import("@/lib/drizzle"));
    await drop();
    await db.execute(sql`CREATE TABLE test_crud_rel_owners (id uuid PRIMARY KEY, name text, deleted_at timestamptz)`);
    await db.execute(sql`CREATE TABLE test_crud_rel_tags (id uuid PRIMARY KEY, deleted_at timestamptz)`);
    await db.execute(sql`
      CREATE TABLE test_crud_rel_joins (
        owner_id uuid NOT NULL REFERENCES test_crud_rel_owners(id) ON DELETE CASCADE,
        tag_id uuid NOT NULL REFERENCES test_crud_rel_tags(id) ON DELETE CASCADE,
        PRIMARY KEY (owner_id, tag_id)
      )
    `);
    service = await buildService("detail");
  });

  after(async () => {
    await drop();
    await (db as unknown as { $client?: { end: () => Promise<void> } }).$client?.end();
  });

  test("既存の関連を残して足し、再追加は何もしない", async () => {
    const [a, b] = [await owner(), await owner()];
    const [t1, t2] = [await tag(), await tag()];
    await db.insert(JoinTable).values({ ownerId: a, tagId: t1 });

    const first = await service.bulkAddRelation("tag_ids", [a, b], [t1, t2]);
    assert.equal(first.count, 3);
    assert.deepEqual([...first.affectedIds].sort(), [a, b].sort());
    assert.deepEqual(await tagsOf(a), [t1, t2].sort());
    assert.deepEqual(await tagsOf(b), [t1, t2].sort());

    const second = await service.bulkAddRelation("tag_ids", [a, b], [t1, t2]);
    assert.equal(second.count, 0);
    assert.deepEqual(second.affectedIds, []);
  });

  test("存在しない id・論理削除済み・形式違いは飛ばして返す", async () => {
    const [a, deletedOwner] = [await owner(), await owner(true)];
    const [t1, deletedTag] = [await tag(), await tag(true)];
    const missingOwner = randomUUID();
    const missingTag = randomUUID();

    const result = await service.bulkAddRelation(
      "tag_ids",
      [a, deletedOwner, missingOwner, "not-a-uuid"],
      [t1, deletedTag, missingTag, "not-a-uuid"],
    );
    assert.equal(result.count, 1);
    assert.deepEqual(result.unknownIds.sort(), [deletedOwner, missingOwner, "not-a-uuid"].sort());
    assert.deepEqual(result.unknownTargetIds.sort(), [deletedTag, missingTag, "not-a-uuid"].sort());
    assert.deepEqual(await tagsOf(a), [t1]);
    assert.deepEqual(await tagsOf(deletedOwner), []);
  });

  test("指定の関連先だけを外し、他は残す", async () => {
    const [a, b] = [await owner(), await owner()];
    const [t1, t2] = [await tag(), await tag()];
    await service.bulkAddRelation("tag_ids", [a, b], [t1, t2]);

    const result = await service.bulkRemoveRelation("tag_ids", [a, b], [t1]);
    assert.equal(result.count, 2);
    assert.deepEqual(await tagsOf(a), [t2]);
    assert.deepEqual(await tagsOf(b), [t2]);

    const again = await service.bulkRemoveRelation("tag_ids", [a, b], [t1]);
    assert.equal(again.count, 0);
  });

  test("論理削除済みのレコードからも外せる", async () => {
    const [a, t1] = [await owner(), await tag()];
    await service.bulkAddRelation("tag_ids", [a], [t1]);
    await db.execute(sql`UPDATE test_crud_rel_owners SET deleted_at = now() WHERE id = ${a}`);

    const result = await service.bulkRemoveRelation("tag_ids", [a], [t1]);
    assert.equal(result.count, 1);
    assert.deepEqual(await tagsOf(a), []);
  });

  test("detail: 変わったレコードごとに記録し、変化が無ければ記録しない", async () => {
    const [a, b] = [await owner(), await owner()];
    const t1 = await tag();
    await db.insert(JoinTable).values({ ownerId: a, tagId: t1 });

    audited = [];
    await service.bulkAddRelation("tag_ids", [a, b], [t1]);
    assert.equal(audited.length, 1);
    assert.equal(audited[0].targetId, b);
    assert.equal(audited[0].action, "owner.relation.added");
    assert.deepEqual(audited[0].metadata, { field: "tag_ids", targetIds: [t1] });
    assert.ok(audited[0].tx, "同じ TX で記録する");

    audited = [];
    await service.bulkAddRelation("tag_ids", [a, b], [t1]);
    assert.equal(audited.length, 0);
  });

  test("aggregate: 1 件にまとめて記録する", async () => {
    const aggregate = await buildService("aggregate");
    const [a, b, t1] = [await owner(), await owner(), await tag()];

    audited = [];
    await aggregate.bulkAddRelation("tag_ids", [a, b], [t1]);
    assert.equal(audited.length, 1);
    assert.equal(audited[0].action, "owner.bulk_relation_added");
  });

  test("上限いっぱいの件数でもパラメータ上限に当たらない", async () => {
    const owners = Array.from({ length: 1000 }, () => randomUUID());
    const tags = Array.from({ length: 50 }, () => randomUUID());
    await db.insert(OwnerTable).values(owners.map((id) => ({ id })));
    await db.insert(TagTable).values(tags.map((id) => ({ id })));

    const result = await service.bulkAddRelation("tag_ids", owners, tags);
    assert.equal(result.count, 50000);
  });

  test("上限超え・belongsToMany でない項目は 400", async () => {
    await assert.rejects(service.bulkAddRelation("tag_ids", Array(1001).fill(randomUUID()), []), (e) => status(e) === 400);
    await assert.rejects(service.bulkAddRelation("tag_ids", [], Array(51).fill(randomUUID())), (e) => status(e) === 400);
    await assert.rejects(service.bulkRemoveRelation("name", [], []), (e) => status(e) === 400);
  });
});
