// src/features/core/storageObject/generatedSchemaBinding.test.ts
// 生成スキーマ（dc:generate の sample）と storage binding の組み合わせ（受入 T-GEN）。
// 編集フォームは全項目を送るので、未変更の旧 URL は「スキーマを通る → binding が前と同値として通す」で保持される。
// 新しい値として書けるのはアップロード済みの ref だけ（旧 URL の差し替え・create は binding が 400）。
// 実行: pnpm test:storage-object

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import type { SessionUser } from "@/features/core/auth/entities/session";
import { SampleCreateSchema, SampleUpdateSchema } from "@/features/sample/entities/schema";
import { runWithAuditContext, type AuditContext } from "@/lib/audit";
import type { DbTransaction } from "@/lib/crud/drizzle/types";
import { DomainError } from "@/lib/errors";
import type { StoragePurposeMap } from "@/lib/storage";
import { createFakeStoragePort, type FakeStoragePort } from "@/lib/storage/server/fake";

import { storageBindingFor } from "./services/server/crudBinding";
import { createMemoryLedger, type MemoryLedger } from "./services/server/ledger/memoryLedger";
import { createStorageObjectService, type StorageObjectService } from "./services/server/storageObjectService";

const TX = undefined as unknown as DbTransaction;

const alice = {
  userId: "11111111-1111-4111-8111-111111111111",
  role: "admin",
  status: "active",
  isDemo: false,
  providerType: "email",
  providerUid: "alice",
  name: null,
} as SessionUser;

const image = { visibility: "public", maxBytes: 10, contentTypes: ["image/*"], upload: { allow: "authenticated" } } as const;
const PURPOSES: StoragePurposeMap = {
  "sample.main_image": image,
  "sample.sub_image": image,
  "sample.gallery_images": image,
};

// 生成される drizzleBase（src/features/sample/services/server/drizzleBase.ts）と同じ宣言
const SAMPLE_FIELDS = [
  { name: "main_image", purpose: "sample.main_image", multi: false },
  { name: "sub_image", purpose: "sample.sub_image", multi: false },
  { name: "gallery_images", purpose: "sample.gallery_images", multi: true },
];

const LEGACY_MAIN = "https://firebasestorage.googleapis.com/v0/b/demo.appspot.com/o/sample%2Fmain%2Fa.png?alt=media&token=t";
const LEGACY_GALLERY = "https://storage.googleapis.com/demo.appspot.com/sample/gallery/b.png";

type Harness = {
  service: StorageObjectService;
  ledger: MemoryLedger;
  fake: FakeStoragePort;
  binding: ReturnType<typeof storageBindingFor>;
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
  });
  const binding = storageBindingFor("sample", SAMPLE_FIELDS, { service, port: () => fake });
  return { service, ledger, fake, binding };
}

function contextOf(actor: SessionUser): AuditContext {
  return { actorId: actor.userId, actorType: "user", ip: null, userAgent: null, sessionId: null, requestId: "test" };
}

const as = <T>(actor: SessionUser, fn: () => Promise<T>) => runWithAuditContext(contextOf(actor), fn);

async function readyRef(h: Harness, purpose: string): Promise<string> {
  const issued = await h.service.issue(alice, { purpose, contentType: "image/png", size: 3 });
  if (issued.transfer.kind !== "put") throw new Error("put expected");
  h.fake.simulateUpload(issued.transfer.url, new Uint8Array(3));
  return (await h.service.commit(alice, issued.objectId)).ref;
}

const rejects400 = (error: unknown) => error instanceof DomainError && error.status === 400;

/** 既存行（旧 URL を持つ、凍結した既存メディア） */
const legacyRow = () => ({ id: "s-1", name: "既存", main_image: LEGACY_MAIN, sub_image: null, gallery_images: [LEGACY_GALLERY] });

/** 編集フォームの送信値（全項目）→ 生成 UpdateSchema → 保存後の行 */
function savedRow(before: Record<string, unknown>, form: Record<string, unknown>) {
  return { ...before, ...SampleUpdateSchema.parse(form) };
}

describe("生成スキーマ（storageMediaValueSchema）", () => {
  test("ref・http(s) を通し、空の単一列は null、それ以外の値は拒否する", () => {
    const ref = "storage://pub/sample.main_image/01920000-0000-7000-8000-000000000001.png";
    const parsed = SampleUpdateSchema.parse({ main_image: ref, sub_image: "", gallery_images: [ref, LEGACY_GALLERY] });
    assert.equal(parsed.main_image, ref);
    assert.equal(parsed.sub_image, null);
    assert.deepEqual(parsed.gallery_images, [ref, LEGACY_GALLERY]);

    for (const bad of ["/images/a.png", "storage://", "ftp://example.com/a.png", "a.png"]) {
      assert.equal(SampleUpdateSchema.safeParse({ main_image: bad }).success, false, bad);
      assert.equal(SampleUpdateSchema.safeParse({ gallery_images: [bad] }).success, false, bad);
    }
  });
});

describe("生成スキーマ + binding（旧 URL の保持）", () => {
  test("旧 URL のまま他の項目だけ編集した保存は通り、何も紐付けない", async () => {
    const h = setup();
    const before = legacyRow();
    const after = savedRow(before, { name: "編集後", main_image: LEGACY_MAIN, sub_image: "", gallery_images: [LEGACY_GALLERY] });
    await as(alice, () => h.binding.afterWrite(TX, before, after));
    assert.equal(after.main_image, LEGACY_MAIN);
    assert.equal(h.ledger.rows.size, 0);
  });

  test("旧 URL を別の http(s) 値へ変えた保存は、スキーマを通っても binding が 400", async () => {
    const h = setup();
    const before = legacyRow();
    const other = "https://storage.googleapis.com/demo.appspot.com/sample/main/other.png";
    const after = savedRow(before, { main_image: other });
    await assert.rejects(as(alice, () => h.binding.afterWrite(TX, before, after)), rejects400);
  });

  test("新しい行に旧 URL を書く create は 400", async () => {
    const h = setup();
    const created = { id: "s-2", ...SampleCreateSchema.parse({ name: "新規", main_image: LEGACY_MAIN }) };
    await assert.rejects(as(alice, () => h.binding.afterWrite(TX, null, created)), rejects400);
  });

  test("旧 URL をアップロード済みの ref に差し替えると ref だけ紐付き、旧 URL は前と同値の複数列でも保持される", async () => {
    const h = setup();
    const mainRef = await readyRef(h, "sample.main_image");
    const galleryRef = await readyRef(h, "sample.gallery_images");
    const before = legacyRow();
    const after = savedRow(before, { main_image: mainRef, gallery_images: [LEGACY_GALLERY, galleryRef] });
    await as(alice, () => h.binding.afterWrite(TX, before, after));

    const attached = [...h.ledger.rows.values()].filter((row) => row.recordId === "s-1");
    assert.deepEqual(attached.map((row) => row.recordField).sort(), ["gallery_images", "main_image"]);
    assert.deepEqual(after.gallery_images, [LEGACY_GALLERY, galleryRef]);
  });
});
