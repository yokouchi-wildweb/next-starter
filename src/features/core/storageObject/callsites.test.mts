// src/features/core/storageObject/callsites.test.mts
// upstream の呼び出し箇所の受入テスト（memoryLedger + fake ポート）。
// - core 用途（src/registry/storagePurposes/core.ts の実物）での private read の代表: 本人 / 明示 admin / 現参加者、
//   退室・logout の後は新しい署名が出ない、admin でもチャット添付は読めない（暗黙の通過なし）
// - 業務行の公開状態を見る private 用途: 非公開化の後は新しい署名が出ない
// - core の保存（アバター・振込明細）が新 ref の検査を迂回しない: 実際の drizzleBase の binding 設定（fields / scope）を使う
// core.ts の check は本物の判定関数（isChatParticipant / isOwnPendingPurchaseRequest）を通す。
// 判定関数が読むデータ源（Firestore のルーム・購入リクエスト・振込レビュー）だけをモックする（下の注記）。
// 実行: pnpm test:storage-object

import { describe, mock, test } from "node:test";
import assert from "node:assert/strict";

import type { SessionUser } from "@/features/core/auth/entities/session";
import type { AuditContext } from "@/lib/audit";
import type { DbTransaction } from "@/lib/crud/drizzle/types";
import type { StoragePurposeMap } from "@/lib/storage";
import type { FakeStoragePort } from "@/lib/storage/server/fake";

// 判定先: ルーム → 参加者、振込依頼 → 依頼者（自社銀行振込・処理中・レビュー未判定）。
// モックは判定関数が読む先にだけ掛け、core.ts の配線と判定関数の条件は実物を動かす。
// mock.module は後から読み込むモジュールにしか効かないため、判定関数に届くモジュールは下で動的 import する。
const ROOM_MEMBERS: Record<string, string[]> = {};
const REQUEST_OWNERS: Record<string, string> = {};

mock.module("@/features/core/chatRoom/services/server/chatRoomService", {
  namedExports: {
    chatRoomService: {
      get: async (roomId: string) => (roomId in ROOM_MEMBERS ? { id: roomId, participants: ROOM_MEMBERS[roomId] } : null),
    },
  },
});
mock.module("@/features/core/purchaseRequest/services/server/drizzleBase", {
  namedExports: {
    base: {
      get: async (id: string) =>
        id in REQUEST_OWNERS
          ? {
              id,
              user_id: REQUEST_OWNERS[id],
              payment_provider: "inhouse",
              payment_method: "bank_transfer_inhouse",
              status: "processing",
            }
          : null,
    },
  },
});
mock.module("@/features/core/bankTransferReview/services/server/wrappers/findHelpers", {
  namedExports: { findByPurchaseRequest: async () => null, findActiveByUser: async () => null },
});

const { UserSelfUpdateSchema, UserUpdateByAdminSchema } = await import("@/features/core/user/entities/schema");
const { baseOptions: userBaseOptions } = await import("@/features/core/user/services/server/drizzleBase");
const { storageBinding: bankTransferReviewBinding } = await import(
  "@/features/core/bankTransferReview/services/server/drizzleBase"
);
const { storageBinding: notificationBinding } = await import("@/features/core/notification/services/server/drizzleBase");
const { runWithAuditContext } = await import("@/lib/audit");
const { createFakeStoragePort, passThroughImageStrip } = await import("@/lib/storage/server/fake");
const { CORE_STORAGE_PURPOSES } = await import("@/registry/storagePurposes/core");
const { storageBindingFor } = await import("./services/server/crudBinding");
const { createMemoryLedger } = await import("./services/server/ledger/memoryLedger");
const { createStorageObjectService } = await import("./services/server/storageObjectService");

const TX = undefined as unknown as DbTransaction;

function user(userId: string, role = "user"): SessionUser {
  return { userId, role, status: "active", isDemo: false, providerType: "email", providerUid: userId, name: null } as SessionUser;
}

const alice = user("11111111-1111-4111-8111-111111111111");
const bob = user("22222222-2222-4222-8222-222222222222");
const admin = user("33333333-3333-4333-8333-333333333333", "admin");

// 業務行の公開状態（テスト用の用途 item.photo の read が見る）
const PUBLISHED: Record<string, boolean> = {};

const PURPOSES: StoragePurposeMap = {
  ...(CORE_STORAGE_PURPOSES as StoragePurposeMap),
  "item.photo": {
    visibility: "private",
    maxBytes: 10,
    contentTypes: ["image/*"],
    upload: { allow: "authenticated" },
    read: {
      allow: "public",
      // allow "public" ではセッションを読まない（actor は常に null）。公開状態だけで決まる
      check: ({ object }) => object.recordId !== null && PUBLISHED[object.recordId] === true,
    },
  },
};

type Harness = {
  service: ReturnType<typeof createStorageObjectService>;
  fake: FakeStoragePort;
};

function setup(): Harness {
  const ledger = createMemoryLedger();
  const fake = createFakeStoragePort();
  let counter = 0;
  const service = createStorageObjectService({
    ledger,
    port: () => fake,
    purposes: () => PURPOSES,
    locate: (store, key) => ({ bucket: `${store}-bucket`, path: key }),
    now: () => new Date(),
    newId: () => `01920000-0000-7000-8000-${String(++counter).padStart(12, "0")}`,
    stripImage: passThroughImageStrip,
  });
  return { service, fake };
}

async function readyRef(h: Harness, actor: SessionUser, purpose: string, scopeId?: string) {
  const issued = await h.service.issue(actor, { purpose, contentType: "image/png", size: 3, scopeId });
  if (issued.transfer.kind !== "put") throw new Error("put expected");
  h.fake.simulateUpload(issued.transfer.url, new Uint8Array(3));
  const { ref } = await h.service.commit(actor, issued.objectId);
  return { ref, objectId: issued.objectId };
}

const read = (h: Harness, objectId: string, actor: SessionUser | null) =>
  h.service.resolveRead(objectId, { loadUser: async () => actor }).then((r) => r.kind);

function contextOf(actor: SessionUser | null): AuditContext {
  return { actorId: actor?.userId ?? null, actorType: actor ? "user" : "system", ip: null, userAgent: null, sessionId: null, requestId: "test" };
}
const as = <T,>(actor: SessionUser | null, fn: () => Promise<T>) => runWithAuditContext(contextOf(actor), fn);
const statusOf = (error: unknown) => (error as { status?: number } | null)?.status;
const rejects400 = (error: unknown) => statusOf(error) === 400;

describe("private read の代表（core 用途の実物）", () => {
  test("振込明細: 本人と admin は署名、他人は 404、logout 後は 401", async () => {
    const h = setup();
    REQUEST_OWNERS["req-1"] = alice.userId;
    const { objectId } = await readyRef(h, alice, "purchaseRequest.bankProof", "req-1");
    assert.equal(await read(h, objectId, alice), "redirect");
    assert.equal(await read(h, objectId, admin), "redirect");
    assert.equal(await read(h, objectId, bob), "not_found");
    assert.equal(await read(h, objectId, null), "unauthenticated");
  });

  test("振込明細: 他人の振込依頼には上げられない", async () => {
    const h = setup();
    REQUEST_OWNERS["req-2"] = bob.userId;
    await assert.rejects(
      h.service.issue(alice, { purpose: "purchaseRequest.bankProof", contentType: "image/png", size: 3, scopeId: "req-2" }),
      (error: unknown) => statusOf(error) === 403,
    );
  });

  test("チャット: 現参加者は署名、退室後は 404、admin でも参加者でなければ 404", async () => {
    const h = setup();
    ROOM_MEMBERS.room1 = [alice.userId, bob.userId];
    const { objectId } = await readyRef(h, alice, "chatRoom.image", "room1");
    assert.equal(await read(h, objectId, alice), "redirect");
    assert.equal(await read(h, objectId, bob), "redirect");
    assert.equal(await read(h, objectId, admin), "not_found");

    ROOM_MEMBERS.room1 = [alice.userId];
    assert.equal(await read(h, objectId, bob), "not_found");
    assert.equal(await read(h, objectId, null), "unauthenticated");
  });

  test("業務行の公開状態を見る用途: 公開中は匿名でも署名、非公開化の後は新しい署名が出ない", async () => {
    const h = setup();
    const { ref, objectId } = await readyRef(h, alice, "item.photo");
    const binding = storageBindingFor("item", [{ name: "photo", purpose: "item.photo" }], { service: h.service, port: () => h.fake });
    await as(alice, () => binding.afterWrite(TX, null, { id: "row-1", photo: ref }));

    PUBLISHED["row-1"] = true;
    assert.equal(await read(h, objectId, null), "redirect");
    PUBLISHED["row-1"] = false;
    assert.equal(await read(h, objectId, null), "not_found");
    assert.equal(await read(h, objectId, bob), "not_found");
  });
});

describe("core の保存が新 ref の検査を迂回しない（実際の binding 設定）", () => {
  const bindingOf = (h: Harness, recordType: string, fields: Parameters<typeof storageBindingFor>[1]) =>
    storageBindingFor(recordType, fields, { service: h.service, port: () => h.fake });

  test("users.avatarUrl は user.avatar に紐付き、ユーザーの物理削除で紐付けを外して実物を消す（D41）", async () => {
    const storage = userBaseOptions.storage;
    assert.deepEqual(storage.fields, [{ name: "avatarUrl", purpose: "user.avatar", multi: false }]);

    const h = setup();
    const binding = bindingOf(h, "user", storage.fields);
    const own = await readyRef(h, alice, "user.avatar");
    const others = await readyRef(h, bob, "user.avatar");
    await assert.rejects(as(alice, () => binding.afterWrite(TX, { id: alice.userId, avatarUrl: null }, { id: alice.userId, avatarUrl: others.ref })), rejects400);
    await assert.rejects(
      as(alice, () => binding.afterWrite(TX, { id: alice.userId, avatarUrl: null }, { id: alice.userId, avatarUrl: "https://example.com/a.png" })),
      rejects400,
    );
    await as(alice, () => binding.afterWrite(TX, { id: alice.userId, avatarUrl: null }, { id: alice.userId, avatarUrl: own.ref }));
    // 旧 URL は同じ値のまま保持できる
    const legacy = "https://storage.googleapis.com/old/avatars/a.png";
    await as(alice, () => binding.afterWrite(TX, { id: alice.userId, avatarUrl: legacy }, { id: alice.userId, avatarUrl: legacy }));

    // 実際の設定は keep でない（退会 = 論理削除では binding は呼ばれない、D45）
    assert.notEqual(storage.onHardDelete, "keep");
    const removed = (await binding.afterHardDelete(TX, [{ id: alice.userId, avatarUrl: own.ref }])) as { objectIds: string[] };
    assert.deepEqual(removed.objectIds, [own.ref.split("/").at(-1)!.split(".")[0]], "アバターの台帳行を外す（実物は commit 後の afterCommit が消す）");
  });

  test("本人更新と管理者更新のどちらの入力スキーマも avatarUrl を通す（admin が自分のアバターを変えても落ちない）", () => {
    const ref = "storage://pub/user.avatar/01920000-0000-7000-8000-000000000001.png";
    assert.equal(UserSelfUpdateSchema.parse({ avatarUrl: ref }).avatarUrl, ref);
    assert.equal(UserUpdateByAdminSchema.parse({ avatarUrl: ref }).avatarUrl, ref);
    assert.equal(UserUpdateByAdminSchema.safeParse({ avatarUrl: "javascript:alert(1)" }).success, false);
  });

  test("振込明細は本人・同じ振込依頼（scopeId）の ref だけが紐付く", async () => {
    const fields = bankTransferReviewBinding.fields;
    assert.equal(fields.length, 1);
    assert.equal(fields[0].name, "proof_image_url");
    assert.equal(fields[0].purpose, "purchaseRequest.bankProof");

    const h = setup();
    const binding = bindingOf(h, "bankTransferReview", fields);
    REQUEST_OWNERS["req-a"] = alice.userId;
    REQUEST_OWNERS["req-b"] = alice.userId;
    REQUEST_OWNERS["req-c"] = bob.userId;
    const forA = await readyRef(h, alice, "purchaseRequest.bankProof", "req-a");
    const forB = await readyRef(h, alice, "purchaseRequest.bankProof", "req-b");
    const bobs = await readyRef(h, bob, "purchaseRequest.bankProof", "req-c");
    const avatar = await readyRef(h, alice, "user.avatar");

    const row = (proof: string) => ({ id: "review-1", purchase_request_id: "req-a", proof_image_url: proof });
    // 別の依頼の画像・他人の画像・別用途の ref・外部 URL は 400
    await assert.rejects(as(alice, () => binding.afterWrite(TX, null, row(forB.ref))), rejects400);
    await assert.rejects(as(alice, () => binding.afterWrite(TX, null, row(bobs.ref))), rejects400);
    await assert.rejects(as(alice, () => binding.afterWrite(TX, null, row(avatar.ref))), rejects400);
    await assert.rejects(as(alice, () => binding.afterWrite(TX, null, row("https://example.com/p.png"))), rejects400);
    await as(alice, () => binding.afterWrite(TX, null, row(forA.ref)));
    // 紐付いた後は本人と admin が読める
    assert.equal(await read(h, forA.objectId, alice), "redirect");
    assert.equal(await read(h, forA.objectId, admin), "redirect");
  });

  test("お知らせの image は送信した admin の未紐付けの ref だけ（sendDirect も同じ binding を通る）", async () => {
    const fields = notificationBinding.fields;
    assert.deepEqual(fields.map((f) => [f.name, f.purpose]), [["image", "notification.image"]]);

    const h = setup();
    const binding = bindingOf(h, "notification", fields);
    const otherAdmin = user("44444444-4444-4444-8444-444444444444", "admin");
    const mine = await readyRef(h, admin, "notification.image");
    const theirs = await readyRef(h, otherAdmin, "notification.image");
    await assert.rejects(as(admin, () => binding.afterWrite(TX, null, { id: "n-1", image: theirs.ref })), rejects400);
    await assert.rejects(
      as(admin, () => binding.afterWrite(TX, null, { id: "n-1", image: "https://storage.googleapis.com/old/n.png" })),
      rejects400,
    );
    await as(admin, () => binding.afterWrite(TX, null, { id: "n-1", image: null }));
    await as(admin, () => binding.afterWrite(TX, null, { id: "n-2", image: mine.ref }));
  });
});

describe("サーバー内の複製と紐付け（coupon の発行）", () => {
  test("ref を owner なしで複製し、actor なしで紐付ける。元の ref は元の行のまま", async () => {
    const h = setup();
    const source = await readyRef(h, admin, "coupon.image_url");
    const copied = await h.service.copy({ source: source.ref, purpose: "coupon.image_url", ownerUserId: null });
    assert.notEqual(copied.ref, source.ref);
    await h.service.attach({
      ref: copied.ref,
      purpose: "coupon.image_url",
      actorUserId: null,
      record: { type: "coupon", id: "c-2", field: "image_url" },
    });
    // 同じ複製を別の行へ二重に紐付けることはできない
    await assert.rejects(
      h.service.attach({
        ref: copied.ref,
        purpose: "coupon.image_url",
        actorUserId: null,
        record: { type: "coupon", id: "c-3", field: "image_url" },
      }),
      rejects400,
    );
  });
});
