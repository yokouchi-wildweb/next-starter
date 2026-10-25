// src/features/core/storageObject/storageObject.test.ts
// ファイル台帳サービスの単体テスト（memoryLedger + fake ポート）。
// issue → commit → attach → detach → 掃除対象化の往復と、発行・commit・取り消し・読み取りの受入項目。
// 描き直しは既定で passThroughImageStrip（中身をそのまま返す）に差し替える。実 sharp で描き直す strip の流れは
// 末尾の「metadata: strip の受け入れ」で確かめる。
// SQL の原子性は test:storage-object-db（実 DB）で別に確かめる。
// 実行: pnpm test:storage-object

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import sharp from "sharp";

import type { SessionUser } from "@/features/core/auth/entities/session";
import { DomainError } from "@/lib/errors";
import type { StoragePurposeMap } from "@/lib/storage";
import { createFakeStoragePort, passThroughImageStrip, type FakeStoragePort } from "@/lib/storage/server/fake";
import { StorageNotConfiguredError, locationOf, type StoragePort } from "@/lib/storage/server";

import { issueUploadInputSchema } from "./services/server/http";
import { createMemoryLedger, type MemoryLedger } from "./services/server/ledger/memoryLedger";
import { getStoragePurposes, withFixedStripPurposes } from "./services/server/purposeSource";
import {
  createStorageObjectService,
  PUBLIC_IMMUTABLE_CACHE_CONTROL,
  type StorageObjectService,
} from "./services/server/storageObjectService";

const MiB = 1024 * 1024;

function user(userId: string, role = "user"): SessionUser {
  return {
    userId,
    role,
    status: "active",
    isDemo: false,
    providerType: "email",
    providerUid: `uid-${userId}`,
    name: null,
  } as SessionUser;
}

const alice = user("11111111-1111-4111-8111-111111111111");
const bob = user("22222222-2222-4222-8222-222222222222");
const admin = user("33333333-3333-4333-8333-333333333333", "admin");

const ROOM_MEMBERS: Record<string, string[]> = { room1: [alice.userId] };

const PURPOSES: StoragePurposeMap = {
  "user.avatar": {
    visibility: "public",
    maxBytes: 10,
    contentTypes: ["image/*"],
    upload: { allow: "authenticated" },
    maxPending: 2,
  },
  // keep の用途（受け取ったまま本来の位置に直送する経路の照合を見る）
  "sample.original": {
    visibility: "public",
    maxBytes: MiB,
    contentTypes: ["image/*"],
    upload: { allow: "authenticated" },
    metadata: "keep",
  },
  "purchaseRequest.bankProof": {
    visibility: "private",
    maxBytes: 10,
    contentTypes: ["image/*"],
    upload: { allow: "authenticated", check: ({ actor, scopeId }) => scopeId === `req-${actor.userId}` },
    read: {
      allow: "authenticated",
      check: ({ actor, object }) => object.ownerUserId === actor?.userId || actor?.role === "admin",
    },
    maxPending: 3,
    metadata: "keep",
  },
  "chatRoom.file": {
    visibility: "private",
    maxBytes: 10,
    contentTypes: ["image/*", "text/html", "application/pdf"],
    upload: {
      allow: "authenticated",
      check: ({ actor, scopeId }) => (ROOM_MEMBERS[scopeId ?? ""] ?? []).includes(actor.userId),
    },
    read: {
      allow: "authenticated",
      check: ({ actor, object }) => (ROOM_MEMBERS[object.scopeId ?? ""] ?? []).includes(actor?.userId ?? ""),
    },
    attach: false,
    metadata: "keep",
  },
  "notification.image": {
    visibility: "public",
    maxBytes: 10,
    contentTypes: ["image/*"],
    upload: { allow: { roleCategories: ["admin"] } },
    delete: { allow: { roleCategories: ["admin"] } },
  },
  "demo.media": {
    visibility: "private",
    maxBytes: 32 * MiB,
    contentTypes: ["image/*", "video/*"],
    upload: { allow: { roleCategories: ["admin"] } },
    read: { allow: "public" },
    maxPending: 1,
  },
  // strip の受け入れテスト用（実際の画像が入る大きさ）
  "profile.photo": {
    visibility: "public",
    maxBytes: MiB,
    contentTypes: ["image/*"],
    upload: { allow: "authenticated" },
  },
  "album.photo": {
    visibility: "private",
    maxBytes: MiB,
    contentTypes: ["image/*", "video/*"],
    upload: { allow: "authenticated" },
    read: { allow: "authenticated" },
    metadata: "strip",
  },
};

type Harness = {
  service: StorageObjectService;
  ledger: MemoryLedger;
  fake: FakeStoragePort;
  clock: { now: Date };
};

function setup(options: { realStrip?: boolean; port?: (fake: FakeStoragePort) => StoragePort } = {}): Harness {
  const ledger = createMemoryLedger();
  const fake = createFakeStoragePort({ now: () => clock.now });
  const port = options.port ? options.port(fake) : fake;
  const clock = { now: new Date("2026-10-22T00:00:00Z") };
  let counter = 0;
  const service = createStorageObjectService({
    ledger,
    port: () => port,
    purposes: () => PURPOSES,
    locate: (store, key) => ({ bucket: `${store}-bucket`, path: key }),
    now: () => clock.now,
    newId: () => `01920000-0000-7000-8000-${String(++counter).padStart(12, "0")}`,
    ...(options.realStrip ? {} : { stripImage: passThroughImageStrip }),
  });
  return { service, ledger, fake, clock };
}

function rejectsWith(status: number) {
  return (error: unknown) => error instanceof DomainError && error.status === status;
}

/** 発行してブラウザの送信を再現する */
async function upload(
  h: Harness,
  actor: SessionUser,
  input: { purpose: string; contentType?: string; size?: number; scopeId?: string },
  body?: Uint8Array,
) {
  const size = input.size ?? 3;
  const issued = await h.service.issue(actor, {
    purpose: input.purpose,
    contentType: input.contentType ?? "image/png",
    size,
    scopeId: input.scopeId,
  });
  if (issued.transfer.kind === "put") {
    h.fake.simulateUpload(issued.transfer.url, body ?? new Uint8Array(size));
  } else {
    h.fake.simulateUpload(issued.transfer.sessionUrl, body ?? new Uint8Array(size));
  }
  return issued;
}

describe("往復: issue → commit → attach → detach → 掃除対象化", () => {
  test("公開の用途", async () => {
    const h = setup();
    const issued = await upload(h, alice, { purpose: "user.avatar" });
    assert.equal(issued.transfer.kind, "put");
    assert.match(issued.ref, /^storage:\/\/pub\/user\.avatar\/[0-9a-f-]+\.png$/);

    const committed = await h.service.commit(alice, issued.objectId);
    assert.equal(committed.ref, issued.ref);
    assert.equal(committed.size, 3);
    const stored = h.fake.objects.get(`pub-bucket/user.avatar/${issued.objectId}.png`);
    assert.equal(stored?.cacheControl, PUBLIC_IMMUTABLE_CACHE_CONTROL);

    const record = { type: "user", id: "u-1", field: "avatar_url" };
    await h.service.attach({ ref: issued.ref, purpose: "user.avatar", actorUserId: alice.userId, record });
    assert.equal(h.ledger.rows.get(issued.objectId)?.recordId, "u-1");

    const detached = await h.service.detach({ refs: [issued.ref], record, reason: "replaced" });
    assert.equal(detached.length, 1);
    await h.service.cleanupDeletedObject(issued.objectId);
    const row = h.ledger.rows.get(issued.objectId);
    assert.equal(row?.status, "deleted");
    assert.equal(row?.reason, "replaced");
    assert.equal(h.fake.objects.has(`pub-bucket/user.avatar/${issued.objectId}.png`), false);
    // 単発 PUT の署名 URL は期限まで使えるので、実物の削除完了は期限後の掃除に残す
    assert.equal(row?.objectRemovedAt, null);

    h.clock.now = new Date(h.clock.now.getTime() + 16 * 60 * 1000);
    await h.service.cleanupDeletedObject(issued.objectId);
    assert.notEqual(h.ledger.rows.get(issued.objectId)?.objectRemovedAt, null);
  });

  test("非公開の用途は commit 後も no-store", async () => {
    const h = setup();
    const issued = await upload(h, alice, { purpose: "purchaseRequest.bankProof", scopeId: `req-${alice.userId}` });
    assert.match(issued.ref, /^storage:\/\/priv\//);
    const committed = await h.service.commit(alice, issued.objectId);
    assert.equal(committed.src, `/api/storage/objects/${issued.objectId}`);
    const stored = h.fake.objects.get(`priv-bucket/purchaseRequest.bankProof/${issued.objectId}.png`);
    assert.equal(stored?.cacheControl, "no-store");
  });
});

describe("issue", () => {
  test("未登録の用途・role 不一致・他人の範囲は拒否し、行もアップロード権も作らない", async () => {
    const h = setup();
    await assert.rejects(h.service.issue(alice, { purpose: "user.cover", contentType: "image/png", size: 1 }), rejectsWith(400));
    await assert.rejects(
      h.service.issue(alice, { purpose: "notification.image", contentType: "image/png", size: 1 }),
      rejectsWith(403),
    );
    await assert.rejects(
      h.service.issue(alice, {
        purpose: "purchaseRequest.bankProof",
        contentType: "image/png",
        size: 1,
        scopeId: `req-${bob.userId}`,
      }),
      rejectsWith(403),
    );
    await assert.rejects(
      h.service.issue(bob, { purpose: "chatRoom.file", contentType: "image/png", size: 1, scopeId: "room1" }),
      rejectsWith(403),
    );
    assert.equal(h.ledger.rows.size, 0);
  });

  test("check の無い用途に scopeId は 400、型の不一致は 400", async () => {
    const h = setup();
    await assert.rejects(
      h.service.issue(alice, { purpose: "user.avatar", contentType: "image/png", size: 1, scopeId: "x" }),
      rejectsWith(400),
    );
    await assert.rejects(h.service.issue(alice, { purpose: "user.avatar", contentType: "text/html", size: 1 }), rejectsWith(400));
  });

  test("maxBytes ちょうど N は通り、N+1 は拒否", async () => {
    const h = setup();
    await h.service.issue(alice, { purpose: "user.avatar", contentType: "image/png", size: 10 });
    await assert.rejects(h.service.issue(alice, { purpose: "user.avatar", contentType: "image/png", size: 11 }), rejectsWith(400));
  });

  test("入力のキー・所有者の注入は拒否（strict）", () => {
    const base = { purpose: "user.avatar", contentType: "image/png", size: 1 };
    assert.equal(issueUploadInputSchema.safeParse(base).success, true);
    assert.equal(issueUploadInputSchema.safeParse({ ...base, key: "user.avatar/evil.png" }).success, false);
    assert.equal(issueUploadInputSchema.safeParse({ ...base, ownerUserId: bob.userId }).success, false);
    assert.equal(issueUploadInputSchema.safeParse({ ...base, size: 1.5 }).success, false);
  });

  test("maxPending: N 件目までは通り、N+1 件目は 429", async () => {
    const h = setup();
    await h.service.issue(alice, { purpose: "user.avatar", contentType: "image/png", size: 1 });
    await h.service.issue(alice, { purpose: "user.avatar", contentType: "image/png", size: 1 });
    await assert.rejects(h.service.issue(alice, { purpose: "user.avatar", contentType: "image/png", size: 1 }), rejectsWith(429));
    // 別の利用者の枠は別
    await h.service.issue(bob, { purpose: "user.avatar", contentType: "image/png", size: 1 });
  });

  test("残り 1 枠へ並行 2 発行して 1 件だけ成功", async () => {
    const h = setup();
    const results = await Promise.allSettled([
      h.service.issue(admin, { purpose: "demo.media", contentType: "image/png", size: 1 }),
      h.service.issue(admin, { purpose: "demo.media", contentType: "image/png", size: 1 }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const rejected = results.find((r) => r.status === "rejected");
    assert.ok(rejected && rejectsWith(429)((rejected as PromiseRejectedResult).reason));
  });

  test("単発 PUT の権が生きている間は、取り消しても枠を返さない", async () => {
    const h = setup();
    const first = await h.service.issue(alice, { purpose: "user.avatar", contentType: "image/png", size: 1 });
    await h.service.issue(alice, { purpose: "user.avatar", contentType: "image/png", size: 1 });
    await h.service.discard(alice, first.objectId);
    await assert.rejects(h.service.issue(alice, { purpose: "user.avatar", contentType: "image/png", size: 1 }), rejectsWith(429));
    // 期限が過ぎれば、取り消した分の枠は戻る
    h.clock.now = new Date(h.clock.now.getTime() + 16 * 60 * 1000);
    await h.service.issue(alice, { purpose: "user.avatar", contentType: "image/png", size: 1 });
  });

  test("再開可能セッションは取り消しで URI を中止し、すぐに枠を返す", async () => {
    const h = setup();
    const issued = await h.service.issue(admin, { purpose: "demo.media", contentType: "video/mp4", size: 17 * MiB });
    assert.equal(issued.transfer.kind, "gcsSession");
    await h.service.discard(admin, issued.objectId);
    const sessionUrl = issued.transfer.kind === "gcsSession" ? issued.transfer.sessionUrl : "";
    assert.throws(() => h.fake.simulateUpload(sessionUrl, new Uint8Array(1)));
    assert.notEqual(h.ledger.rows.get(issued.objectId)?.objectRemovedAt, null);
    await h.service.issue(admin, { purpose: "demo.media", contentType: "video/mp4", size: 17 * MiB });
  });

  test("session_uri はサービスの戻り値に出ない（台帳の内部にだけ残る）", async () => {
    const h = setup();
    const issued = await h.service.issue(admin, { purpose: "demo.media", contentType: "video/mp4", size: 17 * MiB });
    assert.ok(h.ledger.rows.get(issued.objectId)?.sessionUri);
    const detached = await h.ledger.markDeleted(issued.objectId, { reason: "discarded", at: h.clock.now }, { statuses: ["pending"] });
    assert.equal(detached?.sessionUri, null);
  });
});

describe("describePurpose（用途の方針。GET /api/storage/purposes/[purpose]）", () => {
  test("strip / keep / 省略（= strip）を返し、未登録・ID の形式違いは 404", () => {
    const h = setup();
    assert.deepEqual(h.service.describePurpose("album.photo"), { metadata: "strip" });
    assert.deepEqual(h.service.describePurpose("profile.photo"), { metadata: "strip" }, "省略は strip");
    assert.deepEqual(h.service.describePurpose("chatRoom.file"), { metadata: "keep" });
    assert.deepEqual(h.service.describePurpose("purchaseRequest.bankProof"), { metadata: "keep" });
    assert.throws(() => h.service.describePurpose("user.cover"), rejectsWith(404));
    assert.throws(() => h.service.describePurpose("../etc"), rejectsWith(404));
    assert.throws(() => h.service.describePurpose("toString"), rejectsWith(404));
  });

  test("user.avatar は登録表で keep に上書きしても strip と答える", () => {
    const service = createStorageObjectService({
      ledger: createMemoryLedger(),
      port: () => createFakeStoragePort(),
      purposes: () => withFixedStripPurposes({ "user.avatar": { ...PURPOSES["profile.photo"], metadata: "keep" } }),
      locate: (store, key) => ({ bucket: `${store}-bucket`, path: key }),
      now: () => new Date(),
      newId: () => "01920000-0000-7000-8000-000000000001",
    });
    assert.deepEqual(service.describePurpose("user.avatar"), { metadata: "strip" });
  });
});

describe("commit", () => {
  test("他人の ID・存在しない ID は 404、未送信は 409 で pending のまま", async () => {
    const h = setup();
    const issued = await h.service.issue(alice, { purpose: "user.avatar", contentType: "image/png", size: 3 });
    await assert.rejects(h.service.commit(bob, issued.objectId), rejectsWith(404));
    await assert.rejects(h.service.commit(alice, "01920000-0000-7000-8000-999999999999"), rejectsWith(404));
    await assert.rejects(h.service.commit(alice, issued.objectId), rejectsWith(409));
    assert.equal(h.ledger.rows.get(issued.objectId)?.status, "pending");
  });

  test("期限切れは 410 で deleted", async () => {
    const h = setup();
    const issued = await upload(h, alice, { purpose: "user.avatar" });
    h.clock.now = new Date(h.clock.now.getTime() + 16 * 60 * 1000);
    await assert.rejects(h.service.commit(alice, issued.objectId), rejectsWith(410));
    assert.equal(h.ledger.rows.get(issued.objectId)?.reason, "expired");
  });

  test("サイズ・型が申告と違えば 422 で deleted、その世代を消す", async () => {
    const h = setup();
    const bySize = await h.service.issue(alice, { purpose: "sample.original", contentType: "image/png", size: 3 });
    if (bySize.transfer.kind !== "put") throw new Error("put expected");
    h.fake.simulateUpload(bySize.transfer.url, new Uint8Array(5));
    await assert.rejects(h.service.commit(alice, bySize.objectId), rejectsWith(422));
    assert.equal(h.ledger.rows.get(bySize.objectId)?.reason, "size_mismatch");
    assert.equal(h.fake.objects.has(`pub-bucket/sample.original/${bySize.objectId}.png`), false);

    const byType = await h.service.issue(alice, { purpose: "sample.original", contentType: "image/png", size: 3 });
    // 署名を通らない経路で中身の型が差し替わった場合を再現する
    await h.fake.put(
      { bucket: "pub-bucket", path: `sample.original/${byType.objectId}.png` },
      new Uint8Array(3),
      { contentType: "text/html", cacheControl: "no-store" },
    );
    await assert.rejects(h.service.commit(alice, byType.objectId), rejectsWith(422));
    assert.equal(h.ledger.rows.get(byType.objectId)?.reason, "type_mismatch");
  });

  test("再送・並行実行は同じ ref、記録は HEAD の値", async () => {
    const h = setup();
    const issued = await upload(h, alice, { purpose: "sample.original" });
    const [a, b] = await Promise.all([h.service.commit(alice, issued.objectId), h.service.commit(alice, issued.objectId)]);
    const again = await h.service.commit(alice, issued.objectId);
    assert.equal(a.ref, issued.ref);
    assert.equal(b.ref, issued.ref);
    assert.equal(again.ref, issued.ref);
    const row = h.ledger.rows.get(issued.objectId);
    assert.equal(row?.generation, "1");
    assert.equal(row?.size, 3);
  });

  test("取り消し済みは 409", async () => {
    const h = setup();
    const issued = await upload(h, alice, { purpose: "user.avatar" });
    await h.service.discard(alice, issued.objectId);
    await assert.rejects(h.service.commit(alice, issued.objectId), rejectsWith(409));
  });
});

describe("discard / remove", () => {
  test("本人の未採用だけ。再送は安全、他人は 404、紐付け済みは 409", async () => {
    const h = setup();
    const issued = await upload(h, alice, { purpose: "user.avatar" });
    await h.service.commit(alice, issued.objectId);
    await assert.rejects(h.service.discard(bob, issued.objectId), rejectsWith(404));

    const other = await upload(h, alice, { purpose: "user.avatar" });
    await h.service.commit(alice, other.objectId);
    await h.service.attach({
      ref: other.ref,
      purpose: "user.avatar",
      actorUserId: alice.userId,
      record: { type: "user", id: "u-1", field: "avatar_url" },
    });
    await assert.rejects(h.service.discard(alice, other.objectId), rejectsWith(409));

    assert.deepEqual(await h.service.discard(alice, issued.objectId), { ok: true });
    assert.deepEqual(await h.service.discard(alice, issued.objectId), { ok: true });
    assert.equal(h.ledger.rows.get(issued.objectId)?.reason, "discarded");
  });

  test("HTTP 削除は用途の delete 規則がある物だけ", async () => {
    const h = setup();
    const avatar = await upload(h, alice, { purpose: "user.avatar" });
    await assert.rejects(h.service.remove(alice, avatar.objectId), rejectsWith(404));

    const image = await upload(h, admin, { purpose: "notification.image" });
    await assert.rejects(h.service.remove(alice, image.objectId), rejectsWith(404));
    assert.deepEqual(await h.service.remove(admin, image.objectId), { ok: true });
    assert.equal(h.ledger.rows.get(image.objectId)?.reason, "http_deleted");
  });
});

describe("resolveRead（非公開の読み取り）", () => {
  test("本人と明示された管理者は署名 URL、他人は 404、未ログインは 401", async () => {
    const h = setup();
    const issued = await upload(h, alice, { purpose: "purchaseRequest.bankProof", scopeId: `req-${alice.userId}` });
    await h.service.commit(alice, issued.objectId);

    const own = await h.service.resolveRead(issued.objectId, { loadUser: async () => alice });
    assert.equal(own.kind, "redirect");
    if (own.kind === "redirect") {
      assert.match(own.url, /generation=1/);
      assert.match(own.url, /ttl=300/);
      assert.match(own.url, /disposition=inline/);
    }
    assert.equal((await h.service.resolveRead(issued.objectId, { loadUser: async () => admin })).kind, "redirect");
    assert.equal((await h.service.resolveRead(issued.objectId, { loadUser: async () => bob })).kind, "not_found");
    // ログアウト後は新しい署名を得られない
    assert.equal((await h.service.resolveRead(issued.objectId, { loadUser: async () => null })).kind, "unauthenticated");
  });

  test("pending・deleted・公開の用途・形式違いは 404", async () => {
    const h = setup();
    const pending = await h.service.issue(alice, {
      purpose: "purchaseRequest.bankProof",
      contentType: "image/png",
      size: 3,
      scopeId: `req-${alice.userId}`,
    });
    assert.equal((await h.service.resolveRead(pending.objectId, { loadUser: async () => alice })).kind, "not_found");

    const avatar = await upload(h, alice, { purpose: "user.avatar" });
    await h.service.commit(alice, avatar.objectId);
    assert.equal((await h.service.resolveRead(avatar.objectId, { loadUser: async () => alice })).kind, "not_found");

    const proof = await upload(h, alice, { purpose: "purchaseRequest.bankProof", scopeId: `req-${alice.userId}` });
    await h.service.commit(alice, proof.objectId);
    await h.service.discard(alice, proof.objectId);
    assert.equal((await h.service.resolveRead(proof.objectId, { loadUser: async () => alice })).kind, "not_found");
  });

  test("退室した利用者は読めない。HTML は attachment で配る", async () => {
    const h = setup();
    const issued = await upload(h, alice, { purpose: "chatRoom.file", contentType: "text/html", scopeId: "room1" });
    await h.service.commit(alice, issued.objectId);
    const read = await h.service.resolveRead(issued.objectId, { loadUser: async () => alice });
    assert.equal(read.kind, "redirect");
    if (read.kind === "redirect") assert.match(read.url, /disposition=attachment/);

    ROOM_MEMBERS.room1 = [];
    try {
      assert.equal((await h.service.resolveRead(issued.objectId, { loadUser: async () => alice })).kind, "not_found");
    } finally {
      ROOM_MEMBERS.room1 = [alice.userId];
    }
  });

  test("匿名公開の private 用途はセッションを引かずに署名する", async () => {
    const h = setup();
    const issued = await upload(h, admin, { purpose: "demo.media", contentType: "video/mp4" });
    await h.service.commit(admin, issued.objectId);
    let loaded = false;
    const read = await h.service.resolveRead(issued.objectId, {
      loadUser: async () => {
        loaded = true;
        return null;
      },
    });
    assert.equal(read.kind, "redirect");
    if (read.kind === "redirect") assert.match(read.url, /ttl=900/);
    assert.equal(loaded, false);
  });
});

describe("attach（業務行への紐付け）", () => {
  test("本人・ready・用途一致のときだけ。二重採用・改変 ref・pending・範囲違いは 400", async () => {
    const h = setup();
    const record = { type: "purchase_request", id: "r-1", field: "proof_image_url" };
    const issued = await upload(h, alice, { purpose: "purchaseRequest.bankProof", scopeId: `req-${alice.userId}` });

    await assert.rejects(
      h.service.attach({ ref: issued.ref, purpose: "purchaseRequest.bankProof", actorUserId: alice.userId, record }),
      rejectsWith(400),
    );
    await h.service.commit(alice, issued.objectId);

    await assert.rejects(
      h.service.attach({ ref: issued.ref, purpose: "purchaseRequest.bankProof", actorUserId: bob.userId, record }),
      rejectsWith(400),
    );
    await assert.rejects(
      h.service.attach({ ref: issued.ref, purpose: "user.avatar", actorUserId: alice.userId, record }),
      rejectsWith(400),
    );
    await assert.rejects(
      h.service.attach({
        ref: issued.ref.replace(/\.png$/, ".jpg"),
        purpose: "purchaseRequest.bankProof",
        actorUserId: alice.userId,
        record,
      }),
      rejectsWith(400),
    );
    await assert.rejects(
      h.service.attach({
        ref: issued.ref,
        purpose: "purchaseRequest.bankProof",
        actorUserId: alice.userId,
        scopeId: `req-${bob.userId}`,
        record,
      }),
      rejectsWith(400),
    );

    await h.service.attach({
      ref: issued.ref,
      purpose: "purchaseRequest.bankProof",
      actorUserId: alice.userId,
      scopeId: `req-${alice.userId}`,
      record,
    });
    await assert.rejects(
      h.service.attach({ ref: issued.ref, purpose: "purchaseRequest.bankProof", actorUserId: alice.userId, record }),
      rejectsWith(400),
    );
  });
});

describe("サーバー内の書き込みと複製", () => {
  test("putFromServer は owner null の ready、copy は新しい ref の ready", async () => {
    const h = setup();
    const put = await h.service.putFromServer({
      purpose: "notification.image",
      body: new Uint8Array(4),
      contentType: "image/png",
      ownerUserId: null,
    });
    const row = h.ledger.rows.get(put.objectId);
    assert.equal(row?.status, "ready");
    assert.equal(row?.ownerUserId, null);

    const copied = await h.service.copy({ source: put.ref, purpose: "notification.image", ownerUserId: admin.userId });
    assert.notEqual(copied.ref, put.ref);
    assert.equal(h.ledger.rows.get(copied.objectId)?.ownerUserId, admin.userId);
    assert.equal(h.fake.objects.get(`pub-bucket/notification.image/${copied.objectId}.png`)?.cacheControl, PUBLIC_IMMUTABLE_CACHE_CONTROL);
  });

  test("複製元が無い・外部 URL は失敗する（黙って null にしない）", async () => {
    const h = setup();
    await assert.rejects(
      h.service.copy({
        source: "storage://pub/notification.image/01920000-0000-7000-8000-999999999999.png",
        purpose: "notification.image",
        ownerUserId: null,
      }),
      rejectsWith(404),
    );
    await assert.rejects(
      h.service.copy({ source: "https://example.com/a.png", purpose: "notification.image", ownerUserId: null }),
      rejectsWith(404),
    );
  });
});

describe("未設定（保存先の env が空）", () => {
  test("発行は StorageNotConfiguredError ですぐに失敗し、行を作らない", async () => {
    const saved = process.env.STORAGE_PUBLIC_BUCKET;
    delete process.env.STORAGE_PUBLIC_BUCKET;
    try {
      const ledger = createMemoryLedger();
      const service = createStorageObjectService({
        ledger,
        port: () => createFakeStoragePort(),
        purposes: () => PURPOSES,
        locate: locationOf,
        now: () => new Date(),
        newId: () => "01920000-0000-7000-8000-000000000001",
      });
      await assert.rejects(
        service.issue(alice, { purpose: "user.avatar", contentType: "image/png", size: 1 }),
        StorageNotConfiguredError,
      );
      assert.equal(ledger.rows.size, 0);
    } finally {
      if (saved !== undefined) process.env.STORAGE_PUBLIC_BUCKET = saved;
    }
  });

  test("既定のサービスは import でき、未登録の用途は 400、登録済みの用途は保存先の未設定で即失敗", async () => {
    const saved = process.env.STORAGE_PUBLIC_BUCKET;
    delete process.env.STORAGE_PUBLIC_BUCKET;
    try {
      const { storageObjectService } = await import("./services/server/storageObjectService");
      await assert.rejects(
        storageObjectService.issue(alice, { purpose: "user.cover", contentType: "image/png", size: 1 }),
        rejectsWith(400),
      );
      await assert.rejects(
        storageObjectService.issue(alice, { purpose: "user.avatar", contentType: "image/png", size: 1 }),
        StorageNotConfiguredError,
      );
    } finally {
      if (saved !== undefined) process.env.STORAGE_PUBLIC_BUCKET = saved;
    }
  });
});

describe("metadata: strip の受け入れ（実 sharp）", () => {
  /** 位置情報（GPS）入りの EXIF を持つ JPEG */
  async function gpsJpeg(): Promise<Uint8Array> {
    const buffer = await sharp({ create: { width: 24, height: 16, channels: 3, background: { r: 200, g: 40, b: 40 } } })
      .jpeg()
      .withExif({ IFD3: { GPSLatitudeRef: "N", GPSLatitude: "35/1 41/1 22/1", GPSLongitudeRef: "E", GPSLongitude: "139/1 41/1 30/1" } })
      .toBuffer();
    assert.ok((await sharp(buffer).metadata()).exif, "前提: 入力に EXIF が入っている");
    return new Uint8Array(buffer);
  }

  async function exifOf(body: Uint8Array | undefined) {
    assert.ok(body, "保存された物がありません");
    return (await sharp(body).metadata()).exif;
  }

  async function issueAndSend(h: Harness, purpose: string, body: Uint8Array, contentType = "image/jpeg") {
    const issued = await h.service.issue(alice, { purpose, contentType, size: body.byteLength });
    if (issued.transfer.kind !== "put") throw new Error("put expected");
    h.fake.simulateUpload(issued.transfer.url, body);
    return issued;
  }

  const incomingOf = (purpose: string, id: string, store = "pub") => `priv-bucket/incoming/${store}/${purpose}/${id}.jpg`;

  test("非公開の受け取り領域へ送らせ、commit で描き直した物だけを本来の位置に書き、原本を消す", async () => {
    const h = setup({ realStrip: true });
    const body = await gpsJpeg();
    const issued = await issueAndSend(h, "profile.photo", body);
    const finalPath = `pub-bucket/profile.photo/${issued.objectId}.jpg`;

    // 応答の ref は最終の ref（予定値）。受け取り中の行は priv の incoming/… を指す
    assert.equal(issued.ref, `storage://pub/profile.photo/${issued.objectId}.jpg`);
    const pending = h.ledger.rows.get(issued.objectId);
    assert.equal(pending?.store, "priv");
    assert.equal(pending?.key, `incoming/pub/profile.photo/${issued.objectId}.jpg`);
    assert.ok(h.fake.objects.has(incomingOf("profile.photo", issued.objectId)));
    assert.equal(h.fake.objects.has(finalPath), false);

    const committed = await h.service.commit(alice, issued.objectId);
    assert.equal(committed.ref, issued.ref);
    assert.equal(h.fake.objects.has(incomingOf("profile.photo", issued.objectId)), false);
    const stored = h.fake.objects.get(finalPath);
    assert.equal(await exifOf(stored?.body), undefined);
    assert.equal(stored?.cacheControl, PUBLIC_IMMUTABLE_CACHE_CONTROL);

    const row = h.ledger.rows.get(issued.objectId);
    assert.equal(row?.status, "ready");
    assert.equal(row?.store, "pub");
    assert.equal(row?.key, `profile.photo/${issued.objectId}.jpg`);
    assert.equal(row?.size, stored?.body.byteLength);
    assert.equal(row?.generation, stored?.generation);

    // 再 commit は同じ ref。確定した ref は今までどおり紐付けられる
    assert.equal((await h.service.commit(alice, issued.objectId)).ref, issued.ref);
    await h.service.attach({
      ref: issued.ref,
      purpose: "profile.photo",
      actorUserId: alice.userId,
      record: { type: "profile", id: "p1", field: "photo" },
    });
  });

  test("非公開の strip 用途は priv に確定し、読み取りは処理後の世代を署名する", async () => {
    const h = setup({ realStrip: true });
    const issued = await issueAndSend(h, "album.photo", await gpsJpeg());
    await h.service.commit(alice, issued.objectId);
    const stored = h.fake.objects.get(`priv-bucket/album.photo/${issued.objectId}.jpg`);
    assert.equal(await exifOf(stored?.body), undefined);
    const read = await h.service.resolveRead(issued.objectId, { loadUser: async () => alice });
    assert.equal(read.kind, "redirect");
    if (read.kind === "redirect") assert.match(read.url, new RegExp(`generation=${stored?.generation}`));
  });

  test("本来の位置まで書いて止まった commit は、再 commit で描き直さずに確定する", async () => {
    let failIncomingDelete = true;
    const h = setup({
      realStrip: true,
      port: (fake) => ({
        ...fake,
        async delete(location, options) {
          if (failIncomingDelete && location.path.startsWith("incoming/")) throw new Error("一時的な失敗");
          return fake.delete(location, options);
        },
      }),
    });
    const issued = await issueAndSend(h, "profile.photo", await gpsJpeg());
    await assert.rejects(h.service.commit(alice, issued.objectId), /一時的な失敗/);
    const finalPath = `pub-bucket/profile.photo/${issued.objectId}.jpg`;
    const written = h.fake.objects.get(finalPath);
    assert.ok(written, "本来の位置に処理済みの物がある");
    assert.equal(h.ledger.rows.get(issued.objectId)?.status, "pending");

    failIncomingDelete = false;
    const committed = await h.service.commit(alice, issued.objectId);
    assert.equal(committed.ref, issued.ref);
    assert.equal(h.fake.objects.get(finalPath)?.generation, written.generation);
    assert.equal(h.fake.objects.has(incomingOf("profile.photo", issued.objectId)), false);
    assert.equal(h.ledger.rows.get(issued.objectId)?.generation, written.generation);
  });

  test("途中で止まった行の取り消し・期限切れは、受け取り領域と本来の位置の両方を消す", async () => {
    const h = setup({
      realStrip: true,
      port: (fake) => ({
        ...fake,
        async delete(location, options) {
          if (location.path.startsWith("incoming/") && options?.generation) throw new Error("一時的な失敗");
          return fake.delete(location, options);
        },
      }),
    });
    const discarded = await issueAndSend(h, "profile.photo", await gpsJpeg());
    await assert.rejects(h.service.commit(alice, discarded.objectId));
    await h.service.discard(alice, discarded.objectId);
    assert.equal(h.fake.objects.has(`pub-bucket/profile.photo/${discarded.objectId}.jpg`), false);
    assert.equal(h.fake.objects.has(incomingOf("profile.photo", discarded.objectId)), false);

    const expired = await issueAndSend(h, "profile.photo", await gpsJpeg());
    await assert.rejects(h.service.commit(alice, expired.objectId));
    h.clock.now = new Date(h.clock.now.getTime() + 60 * 60 * 1000);
    await assert.rejects(h.service.commit(alice, expired.objectId), rejectsWith(410));
    assert.equal(h.ledger.rows.get(expired.objectId)?.reason, "expired");
    assert.equal(h.fake.objects.has(`pub-bucket/profile.photo/${expired.objectId}.jpg`), false);
    assert.equal(h.fake.objects.has(incomingOf("profile.photo", expired.objectId)), false);
  });

  test("実際の形式が申告と違えば type_mismatch、画像として読めなければ process_failed。どちらも 422 で何も残さない", async () => {
    const h = setup({ realStrip: true });
    const png = new Uint8Array(await sharp({ create: { width: 4, height: 4, channels: 3, background: "red" } }).png().toBuffer());
    const byType = await issueAndSend(h, "profile.photo", png, "image/jpeg");
    await assert.rejects(h.service.commit(alice, byType.objectId), rejectsWith(422));
    assert.equal(h.ledger.rows.get(byType.objectId)?.reason, "type_mismatch");

    const broken = await issueAndSend(h, "profile.photo", new Uint8Array([0xff, 0xd8, 1, 2, 3]));
    await assert.rejects(h.service.commit(alice, broken.objectId), rejectsWith(422));
    assert.equal(h.ledger.rows.get(broken.objectId)?.reason, "process_failed");

    for (const id of [byType.objectId, broken.objectId]) {
      assert.equal(h.fake.objects.has(`pub-bucket/profile.photo/${id}.jpg`), false);
      assert.equal(h.fake.objects.has(incomingOf("profile.photo", id)), false);
    }
  });

  test("strip の用途は描き直せない画像型（HEIC・SVG）を発行で拒否し、keep の用途は受け付ける", async () => {
    const h = setup({ realStrip: true });
    for (const contentType of ["image/heic", "image/svg+xml", "image/tiff"]) {
      await assert.rejects(h.service.issue(alice, { purpose: "profile.photo", contentType, size: 3 }), rejectsWith(400));
    }
    const kept = await h.service.issue(alice, { purpose: "sample.original", contentType: "image/heic", size: 3 });
    assert.equal(h.ledger.rows.get(kept.objectId)?.key, `sample.original/${kept.objectId}.heic`);
  });

  test("keep の用途と、strip の用途の画像以外（動画）は、本来の位置へ直送して中身を変えない", async () => {
    const h = setup({ realStrip: true });
    const body = await gpsJpeg();
    const kept = await issueAndSend(h, "sample.original", body);
    assert.equal(h.ledger.rows.get(kept.objectId)?.key, `sample.original/${kept.objectId}.jpg`);
    await h.service.commit(alice, kept.objectId);
    assert.deepEqual(h.fake.objects.get(`pub-bucket/sample.original/${kept.objectId}.jpg`)?.body, body);

    const video = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70]);
    const issued = await issueAndSend(h, "album.photo", video, "video/mp4");
    assert.equal(h.ledger.rows.get(issued.objectId)?.key, `album.photo/${issued.objectId}.mp4`);
    await h.service.commit(alice, issued.objectId);
    assert.deepEqual(h.fake.objects.get(`priv-bucket/album.photo/${issued.objectId}.mp4`)?.body, video);
  });

  test("putFromServer・copy は宛先が strip の画像なら描き直す（元が strip の用途でも毎回）。keep 宛ては GCS 内の複製", async () => {
    const h = setup({ realStrip: true });
    const body = await gpsJpeg();

    const put = await h.service.putFromServer({ purpose: "profile.photo", body, contentType: "image/jpeg", ownerUserId: null });
    assert.equal(await exifOf(h.fake.objects.get(`pub-bucket/profile.photo/${put.objectId}.jpg`)?.body), undefined);

    const original = await h.service.putFromServer({ purpose: "sample.original", body, contentType: "image/jpeg", ownerUserId: null });
    assert.ok(await exifOf(h.fake.objects.get(`pub-bucket/sample.original/${original.objectId}.jpg`)?.body), "keep は原本のまま");

    const copied = await h.service.copy({ source: original.ref, purpose: "profile.photo", ownerUserId: null });
    const copiedObject = h.fake.objects.get(`pub-bucket/profile.photo/${copied.objectId}.jpg`);
    assert.equal(await exifOf(copiedObject?.body), undefined);
    assert.equal(h.ledger.rows.get(copied.objectId)?.size, copiedObject?.body.byteLength);

    const again = await h.service.copy({ source: put.ref, purpose: "profile.photo", ownerUserId: null });
    assert.ok(h.fake.objects.has(`pub-bucket/profile.photo/${again.objectId}.jpg`));

    const toKeep = await h.service.copy({ source: original.ref, purpose: "sample.original", ownerUserId: null });
    assert.deepEqual(h.fake.objects.get(`pub-bucket/sample.original/${toKeep.objectId}.jpg`)?.body, body);

    await assert.rejects(
      h.service.putFromServer({ purpose: "profile.photo", body: new Uint8Array([1, 2, 3]), contentType: "image/png", ownerUserId: null }),
      rejectsWith(422),
    );
  });

  test("user.avatar は登録表で keep に上書きしても strip で扱う", async () => {
    const overridden = withFixedStripPurposes({
      "user.avatar": { ...PURPOSES["profile.photo"], metadata: "keep" },
      "sample.original": PURPOSES["sample.original"],
    });
    assert.equal(overridden["user.avatar"]?.metadata, "strip");
    assert.equal(overridden["sample.original"]?.metadata, "keep");
    assert.equal(getStoragePurposes()["user.avatar"]?.metadata, "strip");

    const ledger = createMemoryLedger();
    const fake = createFakeStoragePort();
    const service = createStorageObjectService({
      ledger,
      port: () => fake,
      purposes: () => overridden,
      locate: (store, key) => ({ bucket: `${store}-bucket`, path: key }),
      now: () => new Date(),
      newId: () => "01920000-0000-7000-8000-000000000001",
    });
    const body = await gpsJpeg();
    const issued = await service.issue(alice, { purpose: "user.avatar", contentType: "image/jpeg", size: body.byteLength });
    assert.equal(ledger.rows.get(issued.objectId)?.key, `incoming/pub/user.avatar/${issued.objectId}.jpg`);
    if (issued.transfer.kind !== "put") throw new Error("put expected");
    fake.simulateUpload(issued.transfer.url, body);
    await service.commit(alice, issued.objectId);
    assert.equal(await exifOf(fake.objects.get(`pub-bucket/user.avatar/${issued.objectId}.jpg`)?.body), undefined);
  });
});
