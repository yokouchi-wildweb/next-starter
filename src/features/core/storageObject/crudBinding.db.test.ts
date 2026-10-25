// src/features/core/storageObject/crudBinding.db.test.ts
// createCrudService の storage オプションの実 DB テスト（業務行と台帳が同じ TX で動くこと）。
// 開発 DB に専用の表 test_storage_binding_items を作り、終了時に DROP する。台帳には用途 ID `testItem.*` の行を作り、消す。
// ストレージは fake ポート。DATABASE_URL が無ければ全件 skip。先に storage_objects が push 済みであること。
// 実行: pnpm test:storage-binding-db

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";
import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

const envFile = resolve(process.cwd(), process.env.APP_ENV ?? ".env.development");
if (existsSync(envFile)) loadEnv({ path: envFile, quiet: true });

const skip = (process.env.DATABASE_URL ?? "").trim().length === 0;

const TestItemTable = pgTable("test_storage_binding_items", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  photo: text("photo"),
  gallery: text("gallery").array(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

const PURPOSES = {
  "testItem.photo": { visibility: "public", maxBytes: 10, contentTypes: ["image/*"], upload: { allow: "authenticated" } },
  "testItem.gallery": { visibility: "public", maxBytes: 10, contentTypes: ["image/*"], upload: { allow: "authenticated" } },
} as const;

const FIELDS = [
  { name: "photo", purpose: "testItem.photo" },
  { name: "gallery", purpose: "testItem.gallery", multi: true },
];

const ALICE = { userId: randomUUID(), role: "user", status: "active", isDemo: false, providerType: "email", providerUid: "a", name: null };
const BOB = { userId: randomUUID(), role: "user", status: "active", isDemo: false, providerType: "email", providerUid: "b", name: null };

describe("storage オプション（実 DB の TX）", { skip }, () => {
  // 遅延 import（DATABASE_URL を読んでから @/lib/drizzle を初期化する）
  let db: typeof import("@/lib/drizzle").db;
  let ledger: typeof import("./services/server/ledger/drizzleLedger").drizzleLedger;
  let fake: import("@/lib/storage/server/fake").FakeStoragePort;
  let storageService: import("./services/server/storageObjectService").StorageObjectService;
  let hard: any;
  let soft: any;
  let runAs: (actor: typeof ALICE | null, fn: () => Promise<any>) => Promise<any>;
  let failDeletes = false;

  before(async () => {
    ({ db } = await import("@/lib/drizzle"));
    ({ drizzleLedger: ledger } = await import("./services/server/ledger/drizzleLedger"));
    const { createFakeStoragePort, passThroughImageStrip } = await import("@/lib/storage/server/fake");
    const { createStorageObjectService } = await import("./services/server/storageObjectService");
    const { storageBindingFor } = await import("./services/server/crudBinding");
    const { createCrudService } = await import("@/lib/crud/drizzle");
    const { runWithAuditContext } = await import("@/lib/audit");
    const { uuidv7 } = await import("uuidv7");

    fake = createFakeStoragePort();
    const realDelete = fake.delete.bind(fake);
    fake.delete = async (location, options) => {
      if (failDeletes) throw new Error("cloud down");
      return realDelete(location, options);
    };
    storageService = createStorageObjectService({
      ledger,
      port: () => fake,
      purposes: () => PURPOSES as never,
      locate: (store, key) => ({ bucket: `${store}-bucket`, path: key }),
      now: () => new Date(),
      newId: uuidv7,
      stripImage: passThroughImageStrip,
    });
    const binding = storageBindingFor("test_item", FIELDS, { service: storageService, port: () => fake });
    hard = createCrudService(TestItemTable as never, { idType: "uuid", storage: binding });
    soft = createCrudService(TestItemTable as never, { idType: "uuid", useSoftDelete: true, storage: binding });
    runAs = (actor, fn) =>
      runWithAuditContext(
        { actorId: actor?.userId ?? null, actorType: actor ? "user" : "system", ip: null, userAgent: null, sessionId: null, requestId: "test" },
        fn,
      );

    await db.execute(sql`drop table if exists test_storage_binding_items`);
    await db.execute(sql`
      create table test_storage_binding_items (
        id uuid primary key,
        name text not null,
        photo text,
        gallery text[],
        deleted_at timestamptz
      )
    `);
  });

  after(async () => {
    if (!db) return;
    await db.execute(sql`drop table if exists test_storage_binding_items`);
    await db.execute(sql`delete from storage_objects where purpose like 'testItem.%'`);
    await (db as unknown as { $client?: { end: () => Promise<void> } }).$client?.end();
  });

  async function readyRef(actor: typeof ALICE, purpose = "testItem.photo"): Promise<string> {
    const issued = await storageService.issue(actor as never, { purpose, contentType: "image/png", size: 3 });
    if (issued.transfer.kind !== "put") throw new Error("put expected");
    fake.simulateUpload(issued.transfer.url, new Uint8Array(3));
    return (await storageService.commit(actor as never, issued.objectId)).ref;
  }

  const ledgerRow = async (ref: string) => ledger.findById(ref.split("/").at(-1)!.split(".")[0]);
  const status = (error: unknown) => (error as { status?: number }).status;
  const countItems = async () =>
    Number(((await db.execute(sql`select count(*)::int as n from test_storage_binding_items`)) as unknown as { n: number }[])[0].n);

  test("本人・ready・用途一致の ref で保存すると、同じ TX で紐付く", async () => {
    const ref = await readyRef(ALICE);
    const created = await runAs(ALICE, () => hard.create({ name: "a", photo: ref }));
    const row = await ledgerRow(ref);
    assert.equal(row?.recordType, "test_item");
    assert.equal(row?.recordId, created.id);
  });

  test("他人の ref・pending・改変 ref・二重採用は 400 で、業務行も作られない", async () => {
    const before = await countItems();
    const others = await readyRef(BOB);
    await assert.rejects(runAs(ALICE, () => hard.create({ name: "x", photo: others })), (e) => status(e) === 400);

    const pending = await storageService.issue(ALICE as never, { purpose: "testItem.photo", contentType: "image/png", size: 3 });
    await assert.rejects(runAs(ALICE, () => hard.create({ name: "x", photo: pending.ref })), (e) => status(e) === 400);

    const ref = await readyRef(ALICE);
    await assert.rejects(
      runAs(ALICE, () => hard.create({ name: "x", photo: ref.replace(/\.png$/, ".jpg") })),
      (e) => status(e) === 400,
    );
    await runAs(ALICE, () => hard.create({ name: "y", photo: ref }));
    await assert.rejects(runAs(ALICE, () => hard.create({ name: "z", photo: ref })), (e) => status(e) === 400);
    assert.equal(await countItems(), before + 1, "失敗した create の業務行は残らない");
  });

  test("外側の TX が巻き戻ると、紐付けも巻き戻る", async () => {
    const ref = await readyRef(ALICE);
    await assert.rejects(
      runAs(ALICE, () =>
        db.transaction(async (tx) => {
          await hard.create({ name: "rollback", photo: ref }, tx);
          throw new Error("abort");
        }),
      ),
    );
    const row = await ledgerRow(ref);
    assert.equal(row?.status, "ready");
    assert.equal(row?.recordId, null);
  });

  test("差し替えは同じ TX で、外れた ref は replaced、commit 後に実物を消す", async () => {
    const first = await readyRef(ALICE);
    const second = await readyRef(ALICE);
    const item = await runAs(ALICE, () => hard.create({ name: "swap", photo: first }));
    await runAs(ALICE, () => hard.update(item.id, { photo: second }));
    assert.equal((await ledgerRow(first))?.reason, "replaced");
    assert.equal((await ledgerRow(second))?.recordId, item.id);
    assert.equal(fake.objects.has(`pub-bucket/${(await ledgerRow(first))?.key}`), false);

    // 差し替えの途中で紐付けに失敗すると、業務行も外した側も元のまま
    const others = await readyRef(BOB);
    await assert.rejects(runAs(ALICE, () => hard.update(item.id, { photo: others })), (e) => status(e) === 400);
    const latest = await hard.get(item.id);
    assert.equal(latest.photo, second);
    assert.equal((await ledgerRow(second))?.status, "ready");
  });

  test("旧 URL は、変えない update では保持、別の旧 URL への変更と create は不可", async () => {
    const legacy = "https://storage.googleapis.com/old/items/a.png";
    const id = randomUUID();
    await db.execute(sql`insert into test_storage_binding_items (id, name, photo) values (${id}, 'legacy', ${legacy})`);
    await runAs(ALICE, () => hard.update(id, { name: "renamed" }));
    await runAs(ALICE, () => hard.update(id, { name: "again", photo: legacy }));
    await assert.rejects(
      runAs(ALICE, () => hard.update(id, { photo: "https://storage.googleapis.com/old/items/other.png" })),
      (e) => status(e) === 400,
    );
    await assert.rejects(runAs(ALICE, () => hard.create({ name: "n", photo: legacy })), (e) => status(e) === 400);
  });

  test("soft delete では紐付けを残し、restore で戻せる。物理削除で record_removed", async () => {
    const ref = await readyRef(ALICE);
    const item = await runAs(ALICE, () => soft.create({ name: "soft", photo: ref }));
    await soft.remove(item.id);
    assert.equal((await ledgerRow(ref))?.recordId, item.id);
    await soft.restore(item.id);
    assert.equal((await ledgerRow(ref))?.status, "ready");
    await soft.hardDelete(item.id);
    assert.equal((await ledgerRow(ref))?.reason, "record_removed");
  });

  test("実物の削除に失敗しても、台帳は deleted のまま掃除の対象に残る", async () => {
    const ref = await readyRef(ALICE);
    const item = await runAs(ALICE, () => hard.create({ name: "fail", photo: ref }));
    failDeletes = true;
    try {
      await hard.hardDelete(item.id);
    } finally {
      failDeletes = false;
    }
    const row = await ledgerRow(ref);
    assert.equal(row?.status, "deleted");
    assert.equal(row?.objectRemovedAt, null);
    assert.equal(fake.objects.has(`pub-bucket/${row?.key}`), true);
  });

  test("duplicate は copy で新しい ref にして紐付け、1 件でも失敗すれば複製全体を失敗にする", async () => {
    const photo = await readyRef(ALICE);
    const g1 = await readyRef(ALICE, "testItem.gallery");
    const item = await runAs(ALICE, () => hard.create({ name: "dup", photo, gallery: [g1] }));
    const copy = await runAs(BOB, () => hard.duplicate(item.id));
    assert.notEqual(copy.photo, photo);
    assert.equal(copy.gallery.length, 1);
    const copied = await ledgerRow(copy.photo);
    assert.equal(copied?.recordId, copy.id);
    assert.equal(copied?.ownerUserId, BOB.userId);
    assert.equal(fake.objects.get(`pub-bucket/${copied?.key}`)?.cacheControl, "public, max-age=31536000, immutable");

    const before = await countItems();
    const id = randomUUID();
    await db.execute(sql`
      insert into test_storage_binding_items (id, name, photo)
      values (${id}, 'broken', 'storage://pub/testItem.photo/01920000-0000-7000-8000-999999999999.png')
    `);
    await assert.rejects(runAs(ALICE, () => hard.duplicate(id)));
    assert.equal(await countItems(), before + 1, "失敗した複製の行は残らない（元行だけ）");
  });

  test("replaceByQuery は同じ TX で、残る ref の付け替え・新しい ref の紐付け・消えた ref の record_removed を行う", async () => {
    const scope = { field: "name", op: "eq", value: `replace-${randomUUID()}` } as const;
    const kept = await readyRef(ALICE);
    const moved = await readyRef(ALICE);
    const removed = await readyRef(ALICE, "testItem.gallery");
    const r1 = await runAs(ALICE, () => hard.create({ name: scope.value, photo: kept }));
    await runAs(ALICE, () => hard.create({ name: scope.value, photo: moved, gallery: [removed] }));

    const added = await readyRef(ALICE);
    const inserted = await runAs(ALICE, () =>
      hard.replaceByQuery(scope, [{ id: r1.id, photo: kept }, { id: randomUUID(), photo: moved }, { id: randomUUID(), photo: added }]),
    );
    assert.equal(inserted.length, 3);
    assert.equal((await ledgerRow(kept))?.recordId, r1.id);
    assert.equal((await ledgerRow(moved))?.recordId, inserted[1].id);
    assert.equal((await ledgerRow(moved))?.status, "ready");
    assert.equal((await ledgerRow(added))?.recordId, inserted[2].id);
    const gone = await ledgerRow(removed);
    assert.equal(gone?.reason, "record_removed");
    assert.equal(fake.objects.has(`pub-bucket/${gone?.key}`), false, "commit 後に実物を消す");

    // 紐付けに失敗すると、削除も挿入も台帳も元のまま
    const others = await readyRef(BOB);
    await assert.rejects(
      runAs(ALICE, () => hard.replaceByQuery(scope, [{ id: randomUUID(), photo: moved }, { id: randomUUID(), photo: others }])),
      (e) => status(e) === 400,
    );
    assert.equal((await ledgerRow(moved))?.recordId, inserted[1].id);
    assert.equal((await hard.get(inserted[2].id))?.photo, added);

    // 同じ ref を 2 行に入れると 400
    await assert.rejects(
      runAs(ALICE, () => hard.replaceByQuery(scope, [{ id: randomUUID(), photo: added }, { id: randomUUID(), photo: added }])),
      (e) => status(e) === 400,
    );
  });

  test("replaceByQuery（soft delete）は旧行の紐付けを残し、旧行の ref を新しい行に入れると 400", async () => {
    const scope = { field: "name", op: "eq", value: `soft-replace-${randomUUID()}` } as const;
    const ref = await readyRef(ALICE);
    const item = await runAs(ALICE, () => soft.create({ name: scope.value, photo: ref }));
    await assert.rejects(
      runAs(ALICE, () => soft.replaceByQuery(scope, [{ id: randomUUID(), photo: ref }])),
      (e) => status(e) === 400,
    );
    const added = await readyRef(ALICE);
    const [inserted] = await runAs(ALICE, () => soft.replaceByQuery(scope, [{ id: randomUUID(), photo: added }]));
    assert.equal((await ledgerRow(ref))?.recordId, item.id);
    assert.equal((await ledgerRow(ref))?.status, "ready");
    assert.equal((await ledgerRow(added))?.recordId, inserted.id);
  });

  test("bulkUpdate* でメディア列を変える呼び出しは 400", async () => {
    const item = await runAs(ALICE, () => hard.create({ name: "bulk" }));
    await assert.rejects(hard.bulkUpdateByIds([item.id], { photo: null }), (e) => status(e) === 400);
    await hard.bulkUpdateByIds([item.id], { name: "ok" });
  });
});
