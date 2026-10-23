// src/features/core/storageObject/sweep.test.ts
// 掃除（storage-sweep）と、期限切れ put pending の枠返却（L1.13）の単体テスト（memoryLedger + fake ポート）。
// 実行: pnpm test:storage-object

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import type { SessionUser } from "@/features/core/auth/entities/session";
import { DomainError } from "@/lib/errors";
import type { StoragePurposeMap } from "@/lib/storage";
import { createFakeStoragePort, type FakeStoragePort } from "@/lib/storage/server/fake";

import { createMemoryLedger, type MemoryLedger } from "./services/server/ledger/memoryLedger";
import type { StorageLedger } from "./services/server/ledger/types";
import { createStorageObjectService, type StorageObjectService } from "./services/server/storageObjectService";
import { createStorageSweep } from "./services/server/sweep";

const MiB = 1024 * 1024;
const HOUR = 60 * 60 * 1000;

const alice = {
  userId: "11111111-1111-4111-8111-111111111111",
  role: "user",
  status: "active",
  isDemo: false,
  providerType: "email",
  providerUid: "a",
  name: null,
} as SessionUser;

const PURPOSES: StoragePurposeMap = {
  "item.photo": { visibility: "public", maxBytes: 10, contentTypes: ["image/*"], upload: { allow: "authenticated" }, maxPending: 1 },
  "item.video": { visibility: "private", maxBytes: 32 * MiB, contentTypes: ["video/*"], upload: { allow: "authenticated" }, read: { allow: "authenticated" }, maxPending: 1 },
  "chat.file": { visibility: "private", maxBytes: 10, contentTypes: ["image/*"], upload: { allow: "authenticated" }, read: { allow: "authenticated" }, attach: false },
};

type Harness = {
  service: StorageObjectService;
  ledger: MemoryLedger;
  fake: FakeStoragePort;
  clock: { now: Date };
  calls: string[];
  sweep: (options?: { budgetMs?: number; chunkSize?: number }, ledgerOverride?: StorageLedger) => ReturnType<ReturnType<typeof createStorageSweep>["run"]>;
};

function setup(): Harness {
  const ledger = createMemoryLedger();
  const clock = { now: new Date("2026-10-23T00:00:00Z") };
  const fake = createFakeStoragePort({ now: () => clock.now });
  const calls: string[] = [];
  const cancelSession = fake.cancelSession.bind(fake);
  const remove = fake.delete.bind(fake);
  fake.cancelSession = async (url) => {
    calls.push("cancelSession");
    return cancelSession(url);
  };
  fake.delete = async (location, options) => {
    calls.push("delete");
    return remove(location, options);
  };
  let counter = 0;
  const service = createStorageObjectService({
    ledger,
    port: () => fake,
    purposes: () => PURPOSES,
    locate: (store, key) => ({ bucket: `${store}-bucket`, path: key }),
    now: () => clock.now,
    newId: () => `01920000-0000-7000-8000-${String(++counter).padStart(12, "0")}`,
  });
  const sweep: Harness["sweep"] = (options, ledgerOverride) =>
    createStorageSweep({ ledger: ledgerOverride ?? ledger, service, purposes: () => PURPOSES, now: () => clock.now }).run({
      budgetMs: 60_000,
      ...options,
    });
  return { service, ledger, fake, clock, calls, sweep };
}

const later = (h: Harness, ms: number) => {
  h.clock.now = new Date(h.clock.now.getTime() + ms);
};

async function uploaded(h: Harness, purpose = "item.photo", scopeId?: string) {
  const issued = await h.service.issue(alice, { purpose, contentType: "image/png", size: 3, scopeId });
  if (issued.transfer.kind !== "put") throw new Error("put expected");
  h.fake.simulateUpload(issued.transfer.url, new Uint8Array(3));
  return issued;
}

const objectKey = (h: Harness, id: string) => {
  const row = h.ledger.rows.get(id)!;
  return `${row.store}-bucket/${row.key}`;
};

describe("期限切れの pending", () => {
  test("put は期限後に deleted（expired）にして実物を消し、完了にする", async () => {
    const h = setup();
    const issued = await uploaded(h);
    later(h, 16 * 60 * 1000);
    await h.sweep();
    const row = h.ledger.rows.get(issued.objectId);
    assert.equal(row?.status, "deleted");
    assert.equal(row?.reason, "expired");
    assert.notEqual(row?.objectRemovedAt, null);
    assert.equal(h.fake.objects.has(objectKey(h, issued.objectId)), false);
  });

  test("session は URI を中止してから削除する", async () => {
    const h = setup();
    const issued = await h.service.issue(alice, { purpose: "item.video", contentType: "video/mp4", size: 17 * MiB });
    assert.equal(issued.transfer.kind, "gcsSession");
    later(h, 25 * HOUR);
    h.calls.length = 0;
    await h.sweep();
    assert.deepEqual(h.calls.slice(0, 2), ["cancelSession", "delete"]);
    assert.notEqual(h.ledger.rows.get(issued.objectId)?.objectRemovedAt, null);
  });

  test("期限前の pending は触らない", async () => {
    const h = setup();
    const issued = await uploaded(h);
    await h.sweep();
    assert.equal(h.ledger.rows.get(issued.objectId)?.status, "pending");
  });
});

describe("未採用の ready", () => {
  test("猶予を過ぎた未採用は消し、猶予内・紐付け済み・チャットの ready は残す。チャットの pending は期限で消す", async () => {
    const h = setup();
    const stale = await uploaded(h);
    await h.service.commit(alice, stale.objectId);
    const chatReady = await uploaded(h, "chat.file");
    await h.service.commit(alice, chatReady.objectId);
    later(h, 16 * 60 * 1000);
    // 紐付け済みと、猶予内の ready を用意する（枠が 1 なので期限切れの後に発行する）
    const attached = await uploaded(h);
    await h.service.commit(alice, attached.objectId);
    await h.service.attach({ ref: attached.ref, purpose: "item.photo", actorUserId: alice.userId, record: { type: "item", id: "r-1", field: "photo" } });
    const chatPending = await h.service.issue(alice, { purpose: "chat.file", contentType: "image/png", size: 3 });

    later(h, 25 * HOUR);
    await h.sweep();
    assert.equal(h.ledger.rows.get(stale.objectId)?.status, "deleted");
    assert.equal(h.fake.objects.has(objectKey(h, stale.objectId)), false);
    assert.equal(h.ledger.rows.get(attached.objectId)?.status, "ready");
    assert.equal(h.ledger.rows.get(chatReady.objectId)?.status, "ready");
    assert.equal(h.fake.objects.has(objectKey(h, chatReady.objectId)), true);
    assert.equal(h.ledger.rows.get(chatPending.objectId)?.status, "deleted");
  });

  test("掃除の取得と削除の間に attach が成功したら、その物は消さない", async () => {
    const h = setup();
    const issued = await uploaded(h);
    await h.service.commit(alice, issued.objectId);
    later(h, 25 * HOUR);
    const racing: StorageLedger = {
      ...h.ledger,
      async listSweepTargets(target, input) {
        const ids = await h.ledger.listSweepTargets(target, input);
        if (target === "unattachedReady" && ids.includes(issued.objectId)) {
          await h.service.attach({ ref: issued.ref, purpose: "item.photo", actorUserId: alice.userId, record: { type: "item", id: "r-1", field: "photo" } });
        }
        return ids;
      },
    };
    await h.sweep({}, racing);
    assert.equal(h.ledger.rows.get(issued.objectId)?.status, "ready");
    assert.equal(h.ledger.rows.get(issued.objectId)?.recordId, "r-1");
    assert.equal(h.fake.objects.has(objectKey(h, issued.objectId)), true);
  });
});

describe("削除の再試行と安全性", () => {
  test("put の取り消しは期限前に完了にせず、期限後の掃除で完了にする", async () => {
    const h = setup();
    const issued = await uploaded(h);
    await h.service.discard(alice, issued.objectId);
    await h.sweep();
    assert.equal(h.ledger.rows.get(issued.objectId)?.objectRemovedAt, null);
    later(h, 16 * 60 * 1000);
    await h.sweep();
    assert.notEqual(h.ledger.rows.get(issued.objectId)?.objectRemovedAt, null);
  });

  test("実物がもう無くても（404）完了にする", async () => {
    const h = setup();
    const issued = await uploaded(h);
    await h.fake.delete({ bucket: "pub-bucket", path: h.ledger.rows.get(issued.objectId)!.key });
    later(h, 16 * 60 * 1000);
    await h.sweep();
    assert.notEqual(h.ledger.rows.get(issued.objectId)?.objectRemovedAt, null);
  });

  test("重ねて・並行に実行しても安全", async () => {
    const h = setup();
    const issued = await uploaded(h);
    later(h, 16 * 60 * 1000);
    await Promise.all([h.sweep(), h.sweep()]);
    const again = await h.sweep();
    assert.equal(h.ledger.rows.get(issued.objectId)?.status, "deleted");
    assert.equal(again.expiredPending.processed + again.unattachedReady.processed + again.pendingRemoval.processed, 0);
  });

  test("時間予算で途中終了しても、次の実行で続きを片付ける", async () => {
    const h = setup();
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const issued = await uploaded(h, "chat.file");
      ids.push(issued.objectId);
    }
    later(h, 16 * 60 * 1000);
    // 1 チャンクごとに時間がかかる台帳で、締切を確実に越えさせる
    const slow: StorageLedger = {
      ...h.ledger,
      async listSweepTargets(target, input) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return h.ledger.listSweepTargets(target, input);
      },
    };
    const first = await h.sweep({ budgetMs: 10, chunkSize: 1 }, slow);
    assert.equal(first.budgetExhausted, true);
    await h.sweep({ chunkSize: 1 });
    for (const id of ids) assert.notEqual(h.ledger.rows.get(id)?.objectRemovedAt, null);
  });
});

describe("期限切れ put pending の枠返却（L1.13）", () => {
  test("put は期限が過ぎれば掃除を待たずに枠が戻る（deleted / expired / object_removed_at null）", async () => {
    const h = setup();
    const first = await h.service.issue(alice, { purpose: "item.photo", contentType: "image/png", size: 3 });
    await assert.rejects(
      h.service.issue(alice, { purpose: "item.photo", contentType: "image/png", size: 3 }),
      (e) => e instanceof DomainError && e.status === 429,
    );
    later(h, 16 * 60 * 1000);
    await h.service.issue(alice, { purpose: "item.photo", contentType: "image/png", size: 3 });
    const row = h.ledger.rows.get(first.objectId);
    assert.equal(row?.status, "deleted");
    assert.equal(row?.reason, "expired");
    assert.equal(row?.objectRemovedAt, null);
  });

  test("session は期限が過ぎても、掃除が URI を中止するまで枠を返さない", async () => {
    const h = setup();
    await h.service.issue(alice, { purpose: "item.video", contentType: "video/mp4", size: 17 * MiB });
    later(h, 25 * HOUR);
    await assert.rejects(
      h.service.issue(alice, { purpose: "item.video", contentType: "video/mp4", size: 17 * MiB }),
      (e) => e instanceof DomainError && e.status === 429,
    );
    await h.sweep();
    await h.service.issue(alice, { purpose: "item.video", contentType: "video/mp4", size: 17 * MiB });
  });
});
