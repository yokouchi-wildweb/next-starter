// src/features/core/storageObject/crudBinding.test.ts
// storageBindingFor（createCrudService の storage オプション）の規則の単体テスト（memoryLedger + fake ポート）。
// 実際の TX（巻き戻し・同一 TX の差し替え）は test:storage-binding-db で確かめる。
// 実行: pnpm test:storage-object

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import type { SessionUser } from "@/features/core/auth/entities/session";
import { runWithAuditContext, type AuditContext } from "@/lib/audit";
import { applyStorageBinding } from "@/lib/crud/storageIntegration/applyStorageBinding";
import type { DbTransaction } from "@/lib/crud/drizzle/types";
import { DomainError } from "@/lib/errors";
import type { StoragePurposeMap } from "@/lib/storage";
import { createFakeStoragePort, type FakeStoragePort } from "@/lib/storage/server/fake";
import type { StoragePort } from "@/lib/storage/server";

import { storageBindingFor } from "./services/server/crudBinding";
import { createMemoryLedger, type MemoryLedger } from "./services/server/ledger/memoryLedger";
import { createStorageObjectService, type StorageObjectService } from "./services/server/storageObjectService";

const TX = undefined as unknown as DbTransaction;

function user(userId: string): SessionUser {
  return { userId, role: "user", status: "active", isDemo: false, providerType: "email", providerUid: userId, name: null } as SessionUser;
}

const alice = user("11111111-1111-4111-8111-111111111111");
const bob = user("22222222-2222-4222-8222-222222222222");

const PURPOSES: StoragePurposeMap = {
  "item.photo": { visibility: "public", maxBytes: 10, contentTypes: ["image/*"], upload: { allow: "authenticated" } },
  "item.gallery": { visibility: "public", maxBytes: 10, contentTypes: ["image/*"], upload: { allow: "authenticated" } },
  "user.avatar": { visibility: "public", maxBytes: 10, contentTypes: ["image/*"], upload: { allow: "authenticated" } },
};

const FIELDS = [
  { name: "photo", purpose: "item.photo" },
  { name: "gallery", purpose: "item.gallery", multi: true },
];

type Harness = {
  service: StorageObjectService;
  ledger: MemoryLedger;
  fake: FakeStoragePort;
  binding: ReturnType<typeof storageBindingFor>;
};

function setup(options: { onHardDelete?: "detach" | "keep"; port?: () => StoragePort } = {}): Harness {
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
  });
  const binding = storageBindingFor("item", FIELDS, {
    service,
    port: options.port ?? (() => fake),
    onHardDelete: options.onHardDelete,
  });
  return { service, ledger, fake, binding };
}

function contextOf(actor: SessionUser | null): AuditContext {
  return { actorId: actor?.userId ?? null, actorType: actor ? "user" : "system", ip: null, userAgent: null, sessionId: null, requestId: "test" };
}

const as = <T>(actor: SessionUser | null, fn: () => Promise<T>) => runWithAuditContext(contextOf(actor), fn);

/** actor が上げて commit 済みの ref */
async function readyRef(h: Harness, actor: SessionUser, purpose = "item.photo"): Promise<string> {
  const issued = await h.service.issue(actor, { purpose, contentType: "image/png", size: 3 });
  if (issued.transfer.kind !== "put") throw new Error("put expected");
  h.fake.simulateUpload(issued.transfer.url, new Uint8Array(3));
  return (await h.service.commit(actor, issued.objectId)).ref;
}

const idOf = (ref: string) => ref.split("/").at(-1)!.split(".")[0];
const rejects400 = (error: unknown) => error instanceof DomainError && error.status === 400;

describe("afterWrite（create / update）", () => {
  test("本人・ready・用途一致の ref だけが紐付く", async () => {
    const h = setup();
    const ref = await readyRef(h, alice);
    await as(alice, () => h.binding.afterWrite(TX, null, { id: "r-1", photo: ref, gallery: null }));
    const row = h.ledger.rows.get(idOf(ref));
    assert.equal(row?.recordType, "item");
    assert.equal(row?.recordId, "r-1");
    assert.equal(row?.recordField, "photo");
  });

  test("他人の ref・pending・改変 ref・用途違い・二重採用は 400", async () => {
    const h = setup();
    const others = await readyRef(h, bob);
    await assert.rejects(as(alice, () => h.binding.afterWrite(TX, null, { id: "r-1", photo: others })), rejects400);

    const pending = await h.service.issue(alice, { purpose: "item.photo", contentType: "image/png", size: 3 });
    await assert.rejects(as(alice, () => h.binding.afterWrite(TX, null, { id: "r-1", photo: pending.ref })), rejects400);

    const ref = await readyRef(h, alice);
    await assert.rejects(
      as(alice, () => h.binding.afterWrite(TX, null, { id: "r-1", photo: ref.replace(/\.png$/, ".jpg") })),
      rejects400,
    );

    const avatar = await readyRef(h, alice, "user.avatar");
    await assert.rejects(as(alice, () => h.binding.afterWrite(TX, null, { id: "r-1", photo: avatar })), rejects400);

    await as(alice, () => h.binding.afterWrite(TX, null, { id: "r-1", photo: ref }));
    await assert.rejects(as(alice, () => h.binding.afterWrite(TX, null, { id: "r-2", photo: ref })), rejects400);
  });

  test("http(s) は create では拒否、update では前と同じ値だけ通す", async () => {
    const h = setup();
    const legacy = "https://storage.googleapis.com/old/items/a.png";
    await assert.rejects(as(alice, () => h.binding.afterWrite(TX, null, { id: "r-1", photo: legacy })), rejects400);
    await as(alice, () => h.binding.afterWrite(TX, { id: "r-1", photo: legacy }, { id: "r-1", photo: legacy }));
    await assert.rejects(
      as(alice, () =>
        h.binding.afterWrite(TX, { id: "r-1", photo: legacy }, { id: "r-1", photo: "https://storage.googleapis.com/old/other.png" }),
      ),
      rejects400,
    );
  });

  test("差し替えで外れた ref は replaced、commit 後に実物を片付ける", async () => {
    const h = setup();
    const first = await readyRef(h, alice);
    const second = await readyRef(h, alice);
    await as(alice, () => h.binding.afterWrite(TX, null, { id: "r-1", photo: first }));
    const cleanup = await as(alice, () => h.binding.afterWrite(TX, { id: "r-1", photo: first }, { id: "r-1", photo: second }));
    assert.equal(h.ledger.rows.get(idOf(first))?.status, "deleted");
    assert.equal(h.ledger.rows.get(idOf(first))?.reason, "replaced");
    assert.equal(h.ledger.rows.get(idOf(second))?.recordId, "r-1");

    await h.binding.afterCommit([cleanup]);
    assert.equal(h.fake.objects.has(`pub-bucket/item.photo/${idOf(first)}.png`), false);
  });

  test("複数値の列は追加分を紐付け、外れた分だけ解除する", async () => {
    const h = setup();
    const a = await readyRef(h, alice, "item.gallery");
    const b = await readyRef(h, alice, "item.gallery");
    const c = await readyRef(h, alice, "item.gallery");
    await as(alice, () => h.binding.afterWrite(TX, null, { id: "r-1", gallery: [a, b] }));
    await as(alice, () => h.binding.afterWrite(TX, { id: "r-1", gallery: [a, b] }, { id: "r-1", gallery: [b, c] }));
    assert.equal(h.ledger.rows.get(idOf(a))?.status, "deleted");
    assert.equal(h.ledger.rows.get(idOf(b))?.recordId, "r-1");
    assert.equal(h.ledger.rows.get(idOf(c))?.recordId, "r-1");
  });

  test("実物の削除に失敗しても例外にせず、掃除の対象（object_removed_at null）に残る", async () => {
    const failing = createFakeStoragePort();
    const h = setup();
    const first = await readyRef(h, alice);
    await as(alice, () => h.binding.afterWrite(TX, null, { id: "r-1", photo: first }));
    const second = await readyRef(h, alice);
    const cleanup = await as(alice, () => h.binding.afterWrite(TX, { id: "r-1", photo: first }, { id: "r-1", photo: second }));
    failing.delete = async () => {
      throw new Error("cloud down");
    };
    // サービスのポートを壊れたものに差し替えて片付ける
    const broken = storageBindingFor("item", FIELDS, {
      service: createStorageObjectService({
        ledger: h.ledger,
        port: () => failing,
        purposes: () => PURPOSES,
        locate: (store, key) => ({ bucket: `${store}-bucket`, path: key }),
        now: () => new Date(Date.now() + 60 * 60 * 1000),
        newId: () => "unused",
      }),
      port: () => failing,
    });
    await broken.afterCommit([cleanup]);
    const row = h.ledger.rows.get(idOf(first));
    assert.equal(row?.status, "deleted");
    assert.equal(row?.objectRemovedAt, null);
  });
});

describe("afterHardDelete", () => {
  test("ref は record_removed、自分の旧バケットの旧 URL は実物ごと消す", async () => {
    const saved = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "old";
    try {
      const h = setup();
      const ref = await readyRef(h, alice);
      await as(alice, () => h.binding.afterWrite(TX, null, { id: "r-1", photo: ref }));
      await h.fake.put({ bucket: "old", path: "items/legacy.png" }, new Uint8Array(1), { contentType: "image/png", cacheControl: "x" });
      const cleanup = await h.binding.afterHardDelete(TX, [
        { id: "r-1", photo: ref, gallery: ["https://storage.googleapis.com/old/items/legacy.png", "https://example.com/x.png"] },
      ]);
      assert.equal(h.ledger.rows.get(idOf(ref))?.reason, "record_removed");
      await h.binding.afterCommit([cleanup]);
      assert.equal(h.fake.objects.has("old/items/legacy.png"), false);
    } finally {
      if (saved === undefined) delete process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      else process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = saved;
    }
  });

  test("onHardDelete: keep は何もしない（ユーザーの物理削除用）", async () => {
    const h = setup({ onHardDelete: "keep" });
    const ref = await readyRef(h, alice);
    await as(alice, () => h.binding.afterWrite(TX, null, { id: "r-1", photo: ref }));
    await h.binding.afterHardDelete(TX, [{ id: "r-1", photo: ref }]);
    assert.equal(h.ledger.rows.get(idOf(ref))?.status, "ready");
  });
});

describe("afterReplace（replaceByQuery）", () => {
  const HARD = { softDeleted: false };
  const SOFT = { softDeleted: true };

  test("同じ id の行に残る ref はそのまま、別の行へ移る ref は付け替え、新しい ref は紐付け、消えた ref は record_removed", async () => {
    const h = setup();
    const kept = await readyRef(h, alice);
    const moved = await readyRef(h, alice);
    const removed = await readyRef(h, alice, "item.gallery");
    const added = await readyRef(h, alice);
    await as(alice, () => h.binding.afterWrite(TX, null, { id: "r-1", photo: kept }));
    await as(alice, () => h.binding.afterWrite(TX, null, { id: "r-2", photo: moved, gallery: [removed] }));

    const cleanup = await as(alice, () =>
      h.binding.afterReplace!(
        TX,
        [
          { id: "r-1", photo: kept, gallery: null },
          { id: "r-2", photo: moved, gallery: [removed] },
        ],
        [
          { id: "r-1", photo: kept, gallery: null },
          { id: "r-3", photo: moved, gallery: null },
          { id: "r-4", photo: added, gallery: null },
        ],
        HARD,
      ),
    );
    assert.equal(h.ledger.rows.get(idOf(kept))?.recordId, "r-1");
    assert.equal(h.ledger.rows.get(idOf(moved))?.recordId, "r-3");
    assert.equal(h.ledger.rows.get(idOf(moved))?.status, "ready");
    assert.equal(h.ledger.rows.get(idOf(added))?.recordId, "r-4");
    assert.equal(h.ledger.rows.get(idOf(removed))?.reason, "record_removed");

    await h.binding.afterCommit([cleanup]);
    assert.equal(h.fake.objects.has(`pub-bucket/item.gallery/${idOf(removed)}.png`), false);
    assert.equal(h.fake.objects.has(`pub-bucket/item.photo/${idOf(moved)}.png`), true);
  });

  test("同じ値を新しい行の 2 か所に入れると 400（残す行と別の行への共有も不可）", async () => {
    const h = setup();
    const ref = await readyRef(h, alice);
    await as(alice, () => h.binding.afterWrite(TX, null, { id: "r-1", photo: ref }));
    await assert.rejects(
      as(alice, () =>
        h.binding.afterReplace!(TX, [{ id: "r-1", photo: ref }], [{ id: "r-1", photo: ref }, { id: "r-2", photo: ref }], HARD),
      ),
      rejects400,
    );
    const fresh = await readyRef(h, alice);
    await assert.rejects(
      as(alice, () => h.binding.afterReplace!(TX, [], [{ id: "r-3", photo: fresh }, { id: "r-4", photo: fresh }], HARD)),
      rejects400,
    );
  });

  test("新しい値は create と同じ規則（他人の ref・旧 URL は 400）。旧行にあった旧 URL は残せる", async () => {
    const h = setup();
    const others = await readyRef(h, bob);
    await assert.rejects(as(alice, () => h.binding.afterReplace!(TX, [], [{ id: "r-1", photo: others }], HARD)), rejects400);
    const legacy = "https://storage.googleapis.com/old/items/a.png";
    await assert.rejects(as(alice, () => h.binding.afterReplace!(TX, [], [{ id: "r-1", photo: legacy }], HARD)), rejects400);
    await as(alice, () => h.binding.afterReplace!(TX, [{ id: "r-1", photo: legacy }], [{ id: "r-2", photo: legacy }], HARD));
  });

  test("消えた旧 URL は、自分の旧バケットのものだけ実物ごと消す", async () => {
    const saved = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "old";
    try {
      const h = setup();
      await h.fake.put({ bucket: "old", path: "items/legacy.png" }, new Uint8Array(1), { contentType: "image/png", cacheControl: "x" });
      const cleanup = await h.binding.afterReplace!(
        TX,
        [{ id: "r-1", gallery: ["https://storage.googleapis.com/old/items/legacy.png", "https://example.com/x.png"] }],
        [],
        HARD,
      );
      await h.binding.afterCommit([cleanup]);
      assert.equal(h.fake.objects.has("old/items/legacy.png"), false);
    } finally {
      if (saved === undefined) delete process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      else process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = saved;
    }
  });

  test("論理削除の表は旧行の紐付けを残し、旧行の値を新しい行に入れると 400", async () => {
    const h = setup();
    const ref = await readyRef(h, alice);
    await as(alice, () => h.binding.afterWrite(TX, null, { id: "r-1", photo: ref }));
    const added = await readyRef(h, alice);
    await as(alice, () => h.binding.afterReplace!(TX, [{ id: "r-1", photo: ref }], [{ id: "r-2", photo: added }], SOFT));
    assert.equal(h.ledger.rows.get(idOf(ref))?.recordId, "r-1");
    assert.equal(h.ledger.rows.get(idOf(ref))?.status, "ready");
    assert.equal(h.ledger.rows.get(idOf(added))?.recordId, "r-2");
    await assert.rejects(
      as(alice, () => h.binding.afterReplace!(TX, [{ id: "r-1", photo: ref }], [{ id: "r-3", photo: ref }], SOFT)),
      rejects400,
    );
  });

  test("onHardDelete: keep は消えた ref を残す（付け替えと新しい紐付けは行う）", async () => {
    const h = setup({ onHardDelete: "keep" });
    const removed = await readyRef(h, alice);
    await as(alice, () => h.binding.afterWrite(TX, null, { id: "r-1", photo: removed }));
    await as(alice, () => h.binding.afterReplace!(TX, [{ id: "r-1", photo: removed }], [], HARD));
    assert.equal(h.ledger.rows.get(idOf(removed))?.status, "ready");
    assert.equal(h.ledger.rows.get(idOf(removed))?.recordId, "r-1");
  });
});

describe("duplicateValues", () => {
  test("ref を copy で新しい ref にする（所有者 = 実行者）", async () => {
    const h = setup();
    const photo = await readyRef(h, alice);
    const g1 = await readyRef(h, alice, "item.gallery");
    const values = await as(bob, () => h.binding.duplicateValues({ id: "r-1", photo, gallery: [g1] }));
    assert.notEqual(values.photo, photo);
    assert.equal((values.gallery as string[]).length, 1);
    assert.equal(h.ledger.rows.get(idOf(values.photo as string))?.ownerUserId, bob.userId);
  });

  test("1 件でも複製できなければ throw（黙って null にしない）", async () => {
    const h = setup();
    const photo = await readyRef(h, alice);
    await assert.rejects(
      as(alice, () =>
        h.binding.duplicateValues({ id: "r-1", photo, gallery: ["storage://pub/item.gallery/01920000-0000-7000-8000-999999999999.png"] }),
      ),
    );
    await assert.rejects(as(alice, () => h.binding.duplicateValues({ id: "r-1", photo: "https://example.com/a.png" })));
  });
});

describe("applyStorageBinding（bulk の拒否と素通し）", () => {
  const calls: string[] = [];
  const base = {
    create: async (data: unknown) => data,
    update: async () => ({}),
    upsert: async () => ({}),
    remove: async () => {
      calls.push("remove");
    },
    hardDelete: async () => {},
    bulkDeleteByIds: async () => {
      calls.push("bulkDeleteByIds");
    },
    bulkDeleteByQuery: async () => {},
    bulkUpdateByIds: async () => ({ count: 1 }),
    bulkUpdateByQuery: async () => ({ count: 1 }),
    bulkUpdate: async () => ({ count: 1 }),
    bulkUpsert: async () => ({ count: 1 }),
    duplicate: async () => ({}),
    get: async () => undefined,
  };
  const h = setup();
  const wrapped = applyStorageBinding(base as unknown as Parameters<typeof applyStorageBinding>[0], {
    table: { id: {} } as never,
    binding: h.binding,
    useSoftDelete: true,
    conflictTarget: () => ({}) as never,
  });

  test("bulkUpdate* / bulkUpsert でメディア列を変える呼び出しは 400", async () => {
    await assert.rejects(wrapped.bulkUpdateByIds(["a"], { photo: "x" }), rejects400);
    await assert.rejects(wrapped.bulkUpdateByQuery({ field: "id", op: "eq", value: "a" } as never, { gallery: [] }), rejects400);
    await assert.rejects(wrapped.bulkUpdate([{ id: "a", data: { photo: null } }]), rejects400);
    await assert.rejects(wrapped.bulkUpsert([{ id: "a", photo: "x" }]), rejects400);
  });

  test("afterReplace の無い binding では replaceByQuery を 400 で拒否する", async () => {
    const { afterReplace: _omit, ...legacyBinding } = h.binding;
    const noReplace = applyStorageBinding(
      { ...base, replaceByQuery: async () => [] } as unknown as Parameters<typeof applyStorageBinding>[0],
      { table: { id: {} } as never, binding: legacyBinding, useSoftDelete: true, conflictTarget: () => ({}) as never },
    );
    await assert.rejects(noReplace.replaceByQuery({ field: "id", op: "eq", value: "a" } as never, []), rejects400);
  });

  test("論理削除の表でメディア列に触れない replaceByQuery は、そのまま通す", async () => {
    const replaced = applyStorageBinding(
      { ...base, replaceByQuery: async () => [{ id: "b" }] } as unknown as Parameters<typeof applyStorageBinding>[0],
      { table: { id: {} } as never, binding: h.binding, useSoftDelete: true, conflictTarget: () => ({}) as never },
    );
    assert.deepEqual(await replaced.replaceByQuery({ field: "id", op: "eq", value: "a" } as never, [{ name: "x" }]), [{ id: "b" }]);
  });

  test("メディア列に触れない bulk と、soft delete の削除はそのまま通す", async () => {
    assert.deepEqual(await wrapped.bulkUpdateByIds(["a"], { name: "x" }), { count: 1 });
    await wrapped.remove("a");
    await wrapped.bulkDeleteByIds(["a"]);
    assert.deepEqual(calls, ["remove", "bulkDeleteByIds"]);
  });
});
