// src/features/core/storageObject/sweep.test.ts
// 掃除（storage-sweep）・照合（紐付け先の行が消えた ready）と、期限切れ put pending の枠返却（L1.13）の単体テスト
// （memoryLedger + fake ポート + 偽の lookupService）。
// 実行: pnpm test:storage-object

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import type { SessionUser } from "@/features/core/auth/entities/session";
import type { DomainServiceLookup } from "@/lib/domain/types";
import { DomainError } from "@/lib/errors";
import type { StoragePurposeMap } from "@/lib/storage";
import { createFakeStoragePort, passThroughImageStrip, type FakeStoragePort } from "@/lib/storage/server/fake";

import { createMemoryLedger, type MemoryLedger } from "./services/server/ledger/memoryLedger";
import type { StorageLedger } from "./services/server/ledger/types";
import { uuidLowerBoundAt, uuidv7Time, type ReconcileCursor } from "./services/server/reconcileCursor";
import { createStorageObjectService, type StorageObjectService } from "./services/server/storageObjectService";
import { createStorageSweep, type StorageSweepOptions, type StorageSweepServiceLookup } from "./services/server/sweep";

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
  /** 照合の偽の業務行: record_type → まだある行の id（論理削除済みもここに入れる） */
  records: Map<string, Set<string>>;
  /** record_type → 引けない理由（指定が無く records にあれば found） */
  lookupFailures: Map<string, Exclude<DomainServiceLookup, { status: "found" }>>;
  /** searchWithDeleted に渡った limit */
  searchLimits: Array<number | undefined>;
  cursor: { afterId: string | null; resets: number };
  sweep: (options?: StorageSweepOptions, ledgerOverride?: StorageLedger) => ReturnType<ReturnType<typeof createStorageSweep>["run"]>;
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
    stripImage: passThroughImageStrip,
  });
  const records = new Map<string, Set<string>>();
  const lookupFailures = new Map<string, Exclude<DomainServiceLookup, { status: "found" }>>();
  const searchLimits: Array<number | undefined> = [];
  const lookupService: StorageSweepServiceLookup = async (key) => {
    const failure = lookupFailures.get(key);
    if (failure) return failure;
    const existing = records.get(key);
    if (!existing) return { status: "unregistered" };
    return {
      status: "found",
      service: {
        // createCrudService と同じく limit の既定は 100
        async searchWithDeleted(params: { where: { field: string; op: string; value: string[] }; limit?: number }) {
          searchLimits.push(params.limit);
          assert.equal(params.where.field, "id");
          assert.equal(params.where.op, "in");
          const hits = params.where.value.filter((id) => existing.has(id)).map((id) => ({ id }));
          return { results: hits.slice(0, params.limit ?? 100), total: hits.length };
        },
      },
    };
  };
  const cursor = { afterId: null as string | null, resets: 0 };
  const reconcileCursor: ReconcileCursor = {
    async get() {
      return cursor.afterId;
    },
    async advance(lastId) {
      cursor.afterId = lastId;
    },
    async reset() {
      cursor.afterId = null;
      cursor.resets += 1;
    },
  };
  const sweep: Harness["sweep"] = (options, ledgerOverride) =>
    createStorageSweep({
      ledger: ledgerOverride ?? ledger,
      service,
      purposes: () => PURPOSES,
      now: () => clock.now,
      lookupService,
      reconcileCursor,
    }).run({
      budgetMs: 60_000,
      ...options,
    });
  return { service, ledger, fake, clock, calls, records, lookupFailures, searchLimits, cursor, sweep };
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

/** 照合用: 業務行に紐付いた ready の行を台帳に直接作る（id は uuidv7 の形、順序 = n） */
let seq = 0;
async function boundRow(h: Harness, recordType: string, recordId: string) {
  const id = `01930000-0000-7000-8000-${String(++seq).padStart(12, "0")}`;
  await h.ledger.insertReady({
    id,
    purpose: "item.photo",
    store: "pub",
    key: `item.photo/${id}.png`,
    ownerUserId: null,
    scopeId: null,
    size: 3,
    contentType: "image/png",
    generation: "1",
    createdAt: h.clock.now,
  });
  assert.equal(
    await h.ledger.attach({ id, purpose: "item.photo", store: "pub", key: `item.photo/${id}.png`, ownerUserId: null, recordType, recordId, recordField: "photo" }),
    true,
  );
  return id;
}

describe("照合（紐付け先の行が消えた ready）", () => {
  test("行が消えた紐付けだけを detach（record_removed）して実物を消す。論理削除済みの行（searchWithDeleted で見える）は残す", async () => {
    const h = setup();
    const issued = await uploaded(h);
    await h.service.commit(alice, issued.objectId);
    await h.service.attach({ ref: issued.ref, purpose: "item.photo", actorUserId: alice.userId, record: { type: "item", id: "gone", field: "photo" } });
    const alive = await boundRow(h, "item", "alive");
    const softDeleted = await boundRow(h, "item", "soft-deleted");
    h.records.set("item", new Set(["alive", "soft-deleted"]));
    // put の行は署名 URL の期限までは完了にしないので、期限後に回す
    later(h, 16 * 60 * 1000);

    const result = await h.sweep();
    const row = h.ledger.rows.get(issued.objectId);
    assert.equal(row?.status, "deleted");
    assert.equal(row?.reason, "record_removed");
    assert.notEqual(row?.objectRemovedAt, null);
    assert.equal(h.fake.objects.has(objectKey(h, issued.objectId)), false);
    assert.equal(h.ledger.rows.get(alive)?.status, "ready");
    assert.equal(h.ledger.rows.get(softDeleted)?.status, "ready");
    assert.equal(result.reconcile.detached, 1);
    assert.deepEqual(result.reconcile.skipped, []);
    assert.equal(result.orphanedAttached.processed, 3);
    assert.equal(result.orphanedAttached.exhausted, true);
  });

  test("引けない record_type（unregistered / load_failed / unsupported）は消さずに skipped に出す", async () => {
    const h = setup();
    const unregistered = await boundRow(h, "ghost", "r-1");
    const failed = await boundRow(h, "broken", "r-1");
    const unsupported = await boundRow(h, "legacy", "r-1");
    h.lookupFailures.set("broken", { status: "load_failed", error: new Error("boom") });
    h.lookupFailures.set("legacy", { status: "unsupported", missing: ["searchWithDeleted"] });

    const result = await h.sweep();
    for (const id of [unregistered, failed, unsupported]) assert.equal(h.ledger.rows.get(id)?.status, "ready");
    assert.deepEqual(
      result.reconcile.skipped.map((s) => [s.recordType, s.reason]).sort(),
      [["broken", "load_failed"], ["ghost", "unregistered"], ["legacy", "unsupported"]],
    );
    assert.equal(result.reconcile.detached, 0);
  });

  test("大量一致: 1 つの束で massMissingMin 以上の ID が 1 件も見つからなければ、その record_type は消さない", async () => {
    const h = setup();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) ids.push(await boundRow(h, "item", `r-${i}`));
    h.records.set("item", new Set());
    const result = await h.sweep({ massMissingMin: 5 });
    for (const id of ids) assert.equal(h.ledger.rows.get(id)?.status, "ready");
    assert.deepEqual(result.reconcile.skipped.map((s) => s.reason), ["mass_missing"]);

    // 閾値未満なら片付ける
    const small = await h.sweep({ massMissingMin: 6 });
    assert.equal(small.reconcile.detached, 5);
    for (const id of ids) assert.equal(h.ledger.rows.get(id)?.status, "deleted");
  });

  test("1 回の上限（maxDetachPerRun）で止まり、cursor は止まった束の手前に残る。次の実行で続きを片付ける", async () => {
    const h = setup();
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) ids.push(await boundRow(h, "item", `r-${i}`));
    h.records.set("item", new Set(["r-0"]));

    const first = await h.sweep({ maxDetachPerRun: 2, chunkSize: 2 });
    assert.equal(first.reconcile.detached, 2);
    assert.deepEqual(first.reconcile.skipped.map((s) => s.reason), ["detach_limit"]);
    assert.equal(first.orphanedAttached.exhausted, false);
    assert.equal(h.cursor.resets, 0, "上限で止まったら先頭に戻さない");
    assert.equal(h.ledger.rows.get(ids[3])?.status, "ready");

    const second = await h.sweep({ maxDetachPerRun: 2, chunkSize: 2 });
    assert.equal(second.reconcile.detached, 1);
    assert.equal(h.ledger.rows.get(ids[0])?.status, "ready");
    for (const id of ids.slice(1)) assert.equal(h.ledger.rows.get(id)?.status, "deleted");
  });

  test("予算切れで途中終了しても cursor から続け、最後まで行ったら先頭に戻す", async () => {
    const h = setup();
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) ids.push(await boundRow(h, "item", `r-${i}`));
    h.records.set("item", new Set());
    const slow: StorageLedger = {
      ...h.ledger,
      async listAttached(input) {
        await new Promise((resolve) => setTimeout(resolve, 60));
        return h.ledger.listAttached(input);
      },
    };
    const first = await h.sweep({ budgetMs: 100, chunkSize: 1 }, slow);
    assert.equal(first.budgetExhausted, true);
    assert.ok(first.reconcile.detached >= 1 && first.reconcile.detached < 3);
    assert.notEqual(h.cursor.afterId, null);
    assert.equal(h.cursor.resets, 0);

    const second = await h.sweep({ chunkSize: 1 });
    assert.equal(first.reconcile.detached + second.reconcile.detached, 3);
    for (const id of ids) assert.equal(h.ledger.rows.get(id)?.status, "deleted");
    assert.equal(h.cursor.resets, 1);
    assert.equal(h.cursor.afterId, null);
  });

  test("束の ID が 100 を超えても取りこぼさない（searchWithDeleted に束の数を limit で渡す）", async () => {
    const h = setup();
    const alive = new Set<string>();
    const ids: string[] = [];
    for (let i = 0; i < 150; i++) {
      ids.push(await boundRow(h, "item", `r-${i}`));
      alive.add(`r-${i}`);
    }
    h.records.set("item", alive);
    const result = await h.sweep({ chunkSize: 200 });
    assert.deepEqual(h.searchLimits, [150]);
    assert.equal(result.reconcile.detached, 0);
    for (const id of ids) assert.equal(h.ledger.rows.get(id)?.status, "ready");
  });

  test("取り出しと detach の間に置換・付け替えされた行は外さない", async () => {
    const h = setup();
    const replaced = await boundRow(h, "item", "gone");
    const rebound = await boundRow(h, "item", "gone");
    h.records.set("item", new Set(["kept"]));
    const racing: StorageLedger = {
      ...h.ledger,
      async listAttached(input) {
        const rows = await h.ledger.listAttached(input);
        // 取り出した後に、片方は置換で deleted（replaced）、もう片方は別の行へ付け替えられた
        await h.ledger.detach({ ids: [replaced], recordType: "item", recordId: "gone", reason: "replaced", at: h.clock.now });
        await h.ledger.rebind({ id: rebound, purpose: "item.photo", recordType: "item", fromRecordId: "gone", toRecordId: "kept", recordField: "photo" });
        return rows;
      },
    };
    const result = await h.sweep({}, racing);
    assert.equal(result.reconcile.detached, 0);
    assert.equal(h.ledger.rows.get(replaced)?.reason, "replaced");
    assert.equal(h.ledger.rows.get(rebound)?.status, "ready");
    assert.equal(h.ledger.rows.get(rebound)?.recordId, "kept");
  });
});

describe("照合の進み具合（cron_checkpoints の時刻 ↔ uuidv7）", () => {
  test("uuidv7 の時刻を取り出し、その時刻の最小の id はその時刻のどの uuidv7 よりも小さい", () => {
    const id = "019a1b2c-3d4e-7f00-8abc-0123456789ab";
    const time = uuidv7Time(id)!;
    assert.equal(time.getTime(), 0x019a1b2c3d4e);
    const bound = uuidLowerBoundAt(time);
    assert.equal(bound, "019a1b2c-3d4e-0000-0000-000000000000");
    assert.ok(bound < id);
    assert.ok(bound > "019a1b2c-3d4d-7fff-bfff-ffffffffffff", "前のミリ秒の id より後");
  });

  test("uuidv7 でない id は時刻を持たない", () => {
    assert.equal(uuidv7Time("11111111-1111-4111-8111-111111111111"), null);
    assert.equal(uuidv7Time("not-a-uuid"), null);
  });
});
