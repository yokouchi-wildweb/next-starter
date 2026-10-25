// src/features/core/storageObject/services/server/ledger/drizzleLedger.db.test.ts
// drizzleLedger の実 DB テスト（条件付き INSERT / UPDATE が並行実行でも一方だけ成功すること）。
// 開発 DB の storage_objects に、用途 ID `test.*` とランダムな所有者でテスト用の行を作り、終了時に消す。
// DATABASE_URL が無ければ全件 skip。テーブルが無ければ失敗する（先に pnpm db:push）。
// 実行: pnpm test:storage-object-db

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";

const envFile = resolve(process.cwd(), process.env.APP_ENV ?? ".env.development");
if (existsSync(envFile)) loadEnv({ path: envFile, quiet: true });

const skip = (process.env.DATABASE_URL ?? "").trim().length === 0;

type Ledger = typeof import("./drizzleLedger").drizzleLedger;
type NewPendingObject = import("./types").NewPendingObject;

const OWNER = randomUUID();
const PURPOSE = "test.ledgerDb";

let ledger: Ledger;
let cleanup: () => Promise<void>;

function pending(overrides: Partial<NewPendingObject> = {}): NewPendingObject {
  const id = randomUUID();
  const now = new Date();
  return {
    id,
    purpose: PURPOSE,
    store: "priv",
    key: `${PURPOSE}/${id}.png`,
    ownerUserId: OWNER,
    scopeId: null,
    declaredSize: 3,
    contentType: "image/png",
    transferKind: "put",
    expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
    createdAt: now,
    ...overrides,
  };
}

describe("drizzleLedger（実 DB）", { skip }, () => {
  before(async () => {
    ({ drizzleLedger: ledger } = await import("./drizzleLedger"));
    const { db } = await import("@/lib/drizzle");
    const { sql } = await import("drizzle-orm");
    cleanup = async () => {
      await db.execute(sql`delete from storage_objects where purpose like 'test.%' and owner_user_id = ${OWNER}`);
    };
    await cleanup();
  });

  after(async () => {
    await cleanup?.();
    const { db } = await import("@/lib/drizzle");
    await (db as unknown as { $client?: { end: () => Promise<void> } }).$client?.end();
  });

  test("残り 1 枠へ並行 2 発行して 1 件だけ成功する", async () => {
    const now = new Date();
    const results = await Promise.all([
      ledger.insertPendingWithinLimit(pending(), 1, now),
      ledger.insertPendingWithinLimit(pending(), 1, now),
    ]);
    assert.deepEqual(results.filter(Boolean).length, 1);
  });

  test("N 件目までは作れて N+1 件目は作れない。期限内で実物未削除の deleted も数える", async () => {
    await cleanup();
    const now = new Date();
    const first = pending();
    assert.equal(await ledger.insertPendingWithinLimit(first, 2, now), true);
    assert.equal(await ledger.insertPendingWithinLimit(pending(), 2, now), true);
    assert.equal(await ledger.insertPendingWithinLimit(pending(), 2, now), false);

    // 取り消しても、単発 PUT の権が期限内なら枠は戻らない
    await ledger.markDeleted(first.id, { reason: "discarded", at: now }, { statuses: ["pending"] });
    assert.equal(await ledger.insertPendingWithinLimit(pending(), 2, now), false);
    // 実物の削除が済めば戻る
    await ledger.markObjectRemoved(first.id, now);
    assert.equal(await ledger.insertPendingWithinLimit(pending(), 2, now), true);
  });

  test("markReady は store / key を渡せば本来の位置へ書き換える（strip の受け取り領域から確定する行）", async () => {
    await cleanup();
    const id = randomUUID();
    const finalKey = `${PURPOSE}/${id}.jpg`;
    const row = pending({ id, store: "priv", key: `incoming/pub/${finalKey}`, contentType: "image/jpeg" });
    await ledger.insertPendingWithinLimit(row, 5, new Date());

    const ready = await ledger.markReady(id, {
      store: "pub",
      key: finalKey,
      size: 2,
      contentType: "image/jpeg",
      generation: "7",
      readyAt: new Date(),
    });
    assert.equal(ready?.status, "ready");
    assert.equal(ready?.store, "pub");
    assert.equal(ready?.key, finalKey);
    assert.equal(ready?.size, 2);
    assert.equal(ready?.generation, "7");
    const found = await ledger.findById(id);
    assert.equal(found?.store, "pub");
    assert.equal(found?.key, finalKey);

    // 書き換えた位置で ref と同じく紐付く
    assert.equal(
      await ledger.attach({
        id,
        purpose: PURPOSE,
        store: "pub",
        key: finalKey,
        ownerUserId: OWNER,
        recordType: "test_record",
        recordId: "r-strip",
        recordField: "file",
      }),
      true,
    );
  });

  test("ready・用途・所有者の一致で 1 回だけ紐付き、detach で deleted になる", async () => {
    await cleanup();
    const row = pending();
    await ledger.insertPendingWithinLimit(row, 5, new Date());
    const attachInput = {
      id: row.id,
      purpose: PURPOSE,
      store: "priv" as const,
      key: row.key,
      ownerUserId: OWNER,
      recordType: "test_record",
      recordId: "r-1",
      recordField: "file",
    };
    assert.equal(await ledger.attach(attachInput), false, "pending は紐付かない");

    const ready = await ledger.markReady(row.id, { size: 3, contentType: "image/png", generation: "1", readyAt: new Date() });
    assert.equal(ready?.status, "ready");
    assert.equal(ready?.sessionUri, null);
    assert.equal(
      await ledger.markReady(row.id, { size: 3, contentType: "image/png", generation: "2", readyAt: new Date() }),
      null,
      "ready の後は二度目の確定ができない",
    );

    assert.equal(await ledger.attach({ ...attachInput, ownerUserId: randomUUID() }), false, "他人は紐付けられない");
    assert.equal(await ledger.attach({ ...attachInput, key: `${PURPOSE}/${row.id}.jpg` }), false, "改変 ref は紐付かない");

    const results = await Promise.all([ledger.attach(attachInput), ledger.attach(attachInput)]);
    assert.equal(results.filter(Boolean).length, 1, "並行の二重採用は 1 件だけ");

    const rebindInput = {
      id: row.id,
      purpose: PURPOSE,
      recordType: "test_record",
      fromRecordId: "r-1",
      toRecordId: "r-2",
      recordField: "file",
    };
    assert.equal(await ledger.rebind({ ...rebindInput, fromRecordId: "r-x" }), false, "いまの紐付け先が違えば付け替えない");
    assert.equal(await ledger.rebind({ ...rebindInput, recordType: "other" }), false, "種類が違えば付け替えない");
    assert.equal(await ledger.rebind(rebindInput), true);
    assert.equal((await ledger.findById(row.id))?.recordId, "r-2");
    assert.equal(await ledger.rebind(rebindInput), false, "付け替えた後は元の行からは動かせない");
    await ledger.rebind({ ...rebindInput, fromRecordId: "r-2", toRecordId: "r-1" });

    const detached = await ledger.detach({
      ids: [row.id],
      recordType: "test_record",
      recordId: "r-1",
      reason: "replaced",
      at: new Date(),
    });
    assert.equal(detached.length, 1);
    assert.equal(detached[0].status, "deleted");
    assert.equal(detached[0].reason, "replaced");
  });

  test("期限切れの put pending は数える前に deleted（expired）になって枠が戻る。session は戻らない（L1.13）", async () => {
    await cleanup();
    const now = new Date();
    const past = new Date(now.getTime() - 60 * 1000);
    const expiredPut = pending({ expiresAt: past, createdAt: new Date(now.getTime() - 20 * 60 * 1000) });
    assert.equal(await ledger.insertPendingWithinLimit(expiredPut, 5, past), true);
    assert.equal(await ledger.insertPendingWithinLimit(pending(), 1, now), true, "期限切れの put は枠を占めない");
    const row = await ledger.findById(expiredPut.id);
    assert.equal(row?.status, "deleted");
    assert.equal(row?.reason, "expired");
    assert.equal(row?.objectRemovedAt, null);

    await cleanup();
    const expiredSession = pending({ transferKind: "session", expiresAt: past });
    assert.equal(await ledger.insertPendingWithinLimit(expiredSession, 5, past), true);
    assert.equal(await ledger.insertPendingWithinLimit(pending(), 1, now), false, "期限切れの session は掃除まで枠を占める");
    assert.equal((await ledger.findById(expiredSession.id))?.status, "pending");
  });

  test("掃除の対象の取り出し（種類・猶予・除外・keyset）と、条件付きの採用不可", async () => {
    await cleanup();
    const now = new Date();
    const past = new Date(now.getTime() - 60 * 1000);
    // put の期限切れは同じ利用者・用途の次の発行で deleted になる（L1.13）ので、遷移しない session の行で確かめる
    const expired = pending({ expiresAt: past, transferKind: "session" });
    await ledger.insertPendingWithinLimit(expired, 10, past);
    const ready = pending();
    await ledger.insertPendingWithinLimit(ready, 10, now);
    await ledger.markReady(ready.id, { size: 3, contentType: "image/png", generation: "1", readyAt: past });
    const chat = pending({ purpose: "test.chatFile", key: `test.chatFile/${randomUUID()}.png` });
    await ledger.insertPendingWithinLimit(chat, 10, now);
    await ledger.markReady(chat.id, { size: 3, contentType: "image/png", generation: "1", readyAt: past });

    const input = { now, readyBefore: now, excludePurposes: ["test.chatFile"], afterId: null, limit: 10 };
    const mine = (ids: string[]) => ids.filter((id) => [expired.id, ready.id, chat.id].includes(id));
    assert.deepEqual(mine(await ledger.listSweepTargets("expiredPending", input)), [expired.id]);
    assert.deepEqual(mine(await ledger.listSweepTargets("unattachedReady", input)), [ready.id]);
    assert.deepEqual(mine(await ledger.listSweepTargets("unattachedReady", { ...input, readyBefore: new Date(past.getTime() - 1000) })), []);

    // 期限前の put の取り消しは再試行の対象にならず、session はなる
    const putDeleted = pending();
    await ledger.insertPendingWithinLimit(putDeleted, 10, now);
    await ledger.markDeleted(putDeleted.id, { reason: "discarded", at: now }, { statuses: ["pending"] });
    const sessionDeleted = pending({ transferKind: "session" });
    await ledger.insertPendingWithinLimit(sessionDeleted, 10, now);
    await ledger.markDeleted(sessionDeleted.id, { reason: "discarded", at: now }, { statuses: ["pending"] });
    const removal = await ledger.listSweepTargets("pendingRemoval", input);
    assert.equal(removal.includes(putDeleted.id), false);
    assert.equal(removal.includes(sessionDeleted.id), true);

    // 条件付きの採用不可: 紐付いた後は掃除の markDeleted が通らない
    await ledger.attach({ id: ready.id, purpose: PURPOSE, store: "priv", key: ready.key, ownerUserId: OWNER, recordType: "t", recordId: "r", recordField: "f" });
    assert.equal(
      await ledger.markDeleted(ready.id, { reason: "expired", at: now }, { statuses: ["ready"], unattachedOnly: true, readyBefore: now }),
      null,
    );
  });

  test("session_uri は findById だけが返し、更新の戻り値には出ない", async () => {
    await cleanup();
    const row = pending({ transferKind: "session" });
    await ledger.insertPendingWithinLimit(row, 5, new Date());
    await ledger.setSessionUri(row.id, "https://storage.example.test/session/1");
    assert.equal((await ledger.findById(row.id))?.sessionUri, "https://storage.example.test/session/1");
    const deleted = await ledger.markDeleted(row.id, { reason: "discarded", at: new Date() }, { statuses: ["pending"] });
    assert.equal(deleted?.sessionUri, null);
  });
});
