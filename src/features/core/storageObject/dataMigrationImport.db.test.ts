// src/features/core/storageObject/dataMigrationImport.db.test.ts
// dataMigration の import の実 DB テスト（チャンクの TX・binding の attach・copy / putFromServer）。
// 開発 DB に専用の表 test_dm_items を作り、終了時に DROP する。台帳には用途 ID `testDm.*` の行を作り、消す。
// ストレージは fake ポート、旧バケットは env をテスト用の名前に差し替える。DATABASE_URL が無ければ全件 skip。
// 実行: pnpm test:data-migration-db

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

const LEGACY_BUCKET = "legacy-dm-test-bucket";

const TestItemTable = pgTable("test_dm_items", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  photo: text("photo"),
  gallery: text("gallery").array(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

const PURPOSES = {
  "testDm.photo": { visibility: "public", maxBytes: 100, contentTypes: ["image/*"], upload: { allow: "authenticated" } },
  "testDm.gallery": { visibility: "public", maxBytes: 100, contentTypes: ["image/*"], upload: { allow: "authenticated" } },
} as const;

const FIELDS = [
  { name: "photo", purpose: "testDm.photo" },
  { name: "gallery", purpose: "testDm.gallery", multi: true },
];

const ADMIN = { userId: randomUUID(), role: "admin", status: "active", isDemo: false, providerType: "email", providerUid: "adm", name: null };

const legacyUrl = (path: string) =>
  `https://firebasestorage.googleapis.com/v0/b/${LEGACY_BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=t`;

describe("dataMigration import（実 DB の TX）", { skip }, () => {
  let db: typeof import("@/lib/drizzle").db;
  let ledger: typeof import("./services/server/ledger/drizzleLedger").drizzleLedger;
  let fake: import("@/lib/storage/server/fake").FakeStoragePort;
  let storageService: import("./services/server/storageObjectService").StorageObjectService;
  let importServiceChunk: typeof import("@/lib/dataMigration/import/importChunk").importServiceChunk;
  let media: import("@/lib/dataMigration/media").DataMigrationMediaResolver;
  let service: any;
  let runAs: (fn: () => Promise<any>) => Promise<any>;
  const bulkUpsertCalls: { records: Record<string, unknown>[]; options: any }[] = [];
  let failCopies = false;
  const savedLegacyBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  before(async () => {
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = LEGACY_BUCKET;
    ({ db } = await import("@/lib/drizzle"));
    ({ drizzleLedger: ledger } = await import("./services/server/ledger/drizzleLedger"));
    const { createFakeStoragePort, passThroughImageStrip } = await import("@/lib/storage/server/fake");
    const { createStorageObjectService } = await import("./services/server/storageObjectService");
    const { storageBindingFor } = await import("./services/server/crudBinding");
    const { createCrudService } = await import("@/lib/crud/drizzle");
    const { runWithAuditContext } = await import("@/lib/audit");
    const { createDataMigrationMediaResolver } = await import("@/app/api/data-migration/_shared/mediaResolver");
    ({ importServiceChunk } = await import("@/lib/dataMigration/import/importChunk"));
    const { uuidv7 } = await import("uuidv7");

    fake = createFakeStoragePort();
    const realCopy = fake.copy.bind(fake);
    fake.copy = async (source, destination, options) => {
      if (failCopies) throw new Error("cloud down");
      return realCopy(source, destination, options);
    };
    // strip の用途の複製は元を読んで描き直すので、読み取りも同じく失敗させる
    const realRead = fake.read.bind(fake);
    fake.read = async (location, options) => {
      if (failCopies) throw new Error("cloud down");
      return realRead(location, options);
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
    const binding = storageBindingFor("test_dm_item", FIELDS, { service: storageService, port: () => fake });
    const crud = createCrudService(TestItemTable as never, { idType: "uuid", useSoftDelete: true, storage: binding }) as any;
    // bulkUpsert に渡るレコードを記録する（メディア列が渡らないことの確認）
    service = {
      ...crud,
      async bulkUpsert(records: Record<string, unknown>[], options: any, tx: any) {
        bulkUpsertCalls.push({ records, options });
        return crud.bulkUpsert(records, options, tx);
      },
    };
    media = createDataMigrationMediaResolver(ADMIN as never, storageService);
    runAs = (fn) =>
      runWithAuditContext(
        { actorId: ADMIN.userId, actorType: "user", ip: null, userAgent: null, sessionId: null, requestId: "test" },
        fn,
      );

    await db.execute(sql`drop table if exists test_dm_items`);
    await db.execute(sql`
      create table test_dm_items (
        id uuid primary key,
        name text not null,
        photo text,
        gallery text[],
        deleted_at timestamptz
      )
    `);
  });

  after(async () => {
    if (savedLegacyBucket === undefined) delete process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    else process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = savedLegacyBucket;
    if (!db) return;
    await db.execute(sql`drop table if exists test_dm_items`);
    await db.execute(sql`delete from storage_objects where purpose like 'testDm.%'`);
    await (db as unknown as { $client?: { end: () => Promise<void> } }).$client?.end();
  });

  /** CSV を組み立てる（値はそのまま。カンマを含む値はクォート） */
  function csvOf(rows: Record<string, string>[]): string {
    const headers = Object.keys(rows[0]);
    const cell = (v: string) => (v === "" ? '""' : v.includes(",") ? `"${v}"` : v);
    return [headers.join(","), ...rows.map((row) => headers.map((h) => cell(row[h])).join(","))].join("\n");
  }

  const run = (rows: Record<string, string>[], extra: { assets?: Map<string, Uint8Array>; uploadedRefs?: string[] } = {}) =>
    runAs(() => importServiceChunk(service, { domain: "test_dm_item", chunkName: "chunk_001", csvContent: csvOf(rows), media, ...extra }));

  const getRow = async (id: string) =>
    ((await db.execute(sql`select * from test_dm_items where id = ${id}`)) as unknown as Record<string, any>[])[0];
  const countItems = async () =>
    Number(((await db.execute(sql`select count(*)::int as n from test_dm_items`)) as unknown as { n: number }[])[0].n);
  const countLedger = async () =>
    Number(
      ((await db.execute(sql`select count(*)::int as n from storage_objects where purpose like 'testDm.%'`)) as unknown as {
        n: number;
      }[])[0].n,
    );
  const ledgerRow = async (ref: string) => ledger.findById(ref.split("/").at(-1)!.split(".")[0]);
  const seedLegacy = async (path: string, bytes = [1, 2, 3]) => {
    await fake.put({ bucket: LEGACY_BUCKET, path }, new Uint8Array(bytes), { contentType: "image/png", cacheControl: "public" });
    return legacyUrl(path);
  };

  test("旧 URL は copy で新しい ref になり、所有者 = 実行者・業務行に紐付く。元のファイルは変わらない", async () => {
    const source = await seedLegacy(`dm/${randomUUID()}.png`);
    const id = randomUUID();
    const result = await run([{ id, name: "legacy", photo: source }]);
    assert.equal(result.success, true, JSON.stringify(result));

    const row = await getRow(id);
    assert.match(row.photo, /^storage:\/\/pub\/testDm\.photo\//);
    const ledgerEntry = await ledgerRow(row.photo);
    assert.equal(ledgerEntry?.ownerUserId, ADMIN.userId);
    assert.equal(ledgerEntry?.recordId, id);
    assert.equal(ledgerEntry?.recordType, "test_dm_item");
    const original = fake.objects.get(`${LEGACY_BUCKET}/${decodeURIComponent(source.split("/o/")[1].split("?")[0])}`);
    assert.deepEqual(original && [...original.body], [1, 2, 3], "旧バケットのファイルはそのまま");
  });

  test("同梱ファイルは putFromServer、multi は 1 件ずつ新しい ref", async () => {
    const id = randomUUID();
    const assets = new Map([
      ["photo/a.png", new Uint8Array([9])],
      ["gallery/a_1.png", new Uint8Array([8])],
      ["gallery/a_2.png", new Uint8Array([7])],
    ]);
    const result = await run(
      [{ id, name: "assets", photo: "assets/photo/a.png", gallery: "assets/gallery/a_1.png,assets/gallery/a_2.png" }],
      { assets },
    );
    assert.equal(result.success, true, JSON.stringify(result));
    const row = await getRow(id);
    assert.match(row.photo, /^storage:\/\/pub\/testDm\.photo\//);
    assert.equal(row.gallery.length, 2);
    for (const ref of row.gallery) {
      const entry = await ledgerRow(ref);
      assert.equal(entry?.recordId, id);
      assert.equal(entry?.ownerUserId, ADMIN.userId);
    }
  });

  test("外部 URL・/ 始まりはチャンク全体が失敗し、どの行も書かれない（行・列・値がエラーに出る）", async () => {
    const before = await countItems();
    const ledgerBefore = await countLedger();
    const ok = await seedLegacy(`dm/${randomUUID()}.png`);
    for (const bad of ["https://example.com/a.png", "/static/a.png"]) {
      const result = await run([
        { id: randomUUID(), name: "ok", photo: ok },
        { id: randomUUID(), name: "bad", photo: bad },
      ]);
      assert.equal(result.success, false);
      assert.ok(!result.success && result.error.includes("データ行 2") && result.error.includes("photo") && result.error.includes(bad));
    }
    assert.equal(await countItems(), before, "どの行も書かれない");
    // 1 行目の copy は解決済み（未紐付けの ready として残り、掃除 cron が消す）
    const leftovers = (await db.execute(
      sql`select count(*)::int as n from storage_objects where purpose like 'testDm.%' and record_id is null and status = 'ready'`,
    )) as unknown as { n: number }[];
    assert.ok(Number(leftovers[0].n) >= 1);
    assert.ok((await countLedger()) >= ledgerBefore);
  });

  test("copy に失敗すると、元の ref を複製先に残さずチャンクが失敗する（multi も黙って欠落させない）", async () => {
    // 複製元: 別の行に紐付いた ref
    const sourceId = randomUUID();
    await run([{ id: sourceId, name: "source", photo: await seedLegacy(`dm/${randomUUID()}.png`) }]);
    const sourceRef = (await getRow(sourceId)).photo as string;

    const before = await countItems();
    const targetId = randomUUID();
    failCopies = true;
    try {
      const single = await run([{ id: targetId, name: "copy-fail", photo: sourceRef }]);
      assert.equal(single.success, false);
      const multi = await run([{ id: targetId, name: "multi-fail", photo: "", gallery: `${sourceRef},${sourceRef}` }]);
      assert.equal(multi.success, false);
    } finally {
      failCopies = false;
    }
    assert.equal(await countItems(), before);
    assert.equal(await getRow(targetId), undefined, "複製先の行は作られない（元の ref が入らない）");
    assert.equal((await ledgerRow(sourceRef))?.recordId, sourceId, "複製元の紐付けはそのまま");

    // multi の一部だけ複製できない（旧バケットに無い）場合も全体が失敗
    const partial = await run([
      { id: targetId, name: "partial", photo: "", gallery: `${await seedLegacy(`dm/${randomUUID()}.png`)},${legacyUrl("dm/missing.png")}` },
    ]);
    assert.equal(partial.success, false);
    assert.equal(await getRow(targetId), undefined);

    // 成功する場合は、別の行の ref も複製して新しい ref になる（同じ ref を 2 行で共有しない）
    const ok = await run([{ id: targetId, name: "copied", photo: sourceRef }]);
    assert.equal(ok.success, true, JSON.stringify(ok));
    const copied = (await getRow(targetId)).photo as string;
    assert.notEqual(copied, sourceRef);
    assert.equal((await ledgerRow(copied))?.recordId, targetId);
  });

  test("今回アップロードした ref はそのまま紐付き、既存と同じ値は保持（複製しない）。空は外す。CSV に無い列は触らない", async () => {
    const issued = await storageService.issue(ADMIN as never, { purpose: "testDm.photo", contentType: "image/png", size: 3 });
    if (issued.transfer.kind !== "put") throw new Error("put expected");
    fake.simulateUpload(issued.transfer.url, new Uint8Array(3));
    const uploaded = (await storageService.commit(ADMIN as never, issued.objectId)).ref;

    const id = randomUUID();
    const first = await run([{ id, name: "uploaded", photo: uploaded, gallery: "" }], { uploadedRefs: [uploaded] });
    assert.equal(first.success, true, JSON.stringify(first));
    assert.equal((await getRow(id)).photo, uploaded);
    assert.equal((await ledgerRow(uploaded))?.recordId, id);

    // 同じ値の再 import: 台帳の行は増えない
    const ledgerBefore = await countLedger();
    const again = await run([{ id, name: "renamed", photo: uploaded }]);
    assert.equal(again.success, true, JSON.stringify(again));
    assert.equal((await getRow(id)).photo, uploaded);
    assert.equal((await getRow(id)).name, "renamed");
    assert.equal(await countLedger(), ledgerBefore);

    // メディア列の無い CSV: 値は変わらない
    const noMedia = await run([{ id, name: "no-media" }]);
    assert.equal(noMedia.success, true, JSON.stringify(noMedia));
    assert.equal((await getRow(id)).photo, uploaded);

    // 空: 値を外し、台帳は deleted（replaced）
    const cleared = await run([{ id, name: "cleared", photo: "" }]);
    assert.equal(cleared.success, true, JSON.stringify(cleared));
    assert.equal((await getRow(id)).photo, null);
    const entry = await ledgerRow(uploaded);
    assert.equal(entry?.status, "deleted");
    assert.equal(entry?.reason, "replaced");
  });

  test("bulkUpsert にはメディア列が渡らず、UPDATE SET からも外す", async () => {
    bulkUpsertCalls.length = 0;
    const id = randomUUID();
    const result = await run([{ id, name: "spy", photo: await seedLegacy(`dm/${randomUUID()}.png`), gallery: "" }]);
    assert.equal(result.success, true, JSON.stringify(result));
    assert.equal(bulkUpsertCalls.length, 1);
    for (const record of bulkUpsertCalls[0].records) {
      assert.equal("photo" in record, false);
      assert.equal("gallery" in record, false);
    }
    assert.deepEqual([...bulkUpsertCalls[0].options.excludeFromUpdate].sort(), ["gallery", "photo"]);
  });
});
