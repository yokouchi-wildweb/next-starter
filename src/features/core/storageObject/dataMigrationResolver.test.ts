// src/features/core/storageObject/dataMigrationResolver.test.ts
// dataMigration に注入する resolver（src/app/api/data-migration/_shared/mediaResolver.ts）の単体テスト（memoryLedger + fake ポート）。
// import の所有者 = 実行者、export の ref 解決（pub は公開 URL、priv は実行者で read 判定。admin の暗黙通過なし）。
// 実行: pnpm test:data-migration

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";

import { createDataMigrationMediaResolver } from "@/app/api/data-migration/_shared/mediaResolver";
import type { SessionUser } from "@/features/core/auth/entities/session";
import type { StoragePurposeMap } from "@/lib/storage";
import { createFakeStoragePort } from "@/lib/storage/server/fake";

import { createMemoryLedger } from "./services/server/ledger/memoryLedger";
import { createStorageObjectService } from "./services/server/storageObjectService";

const admin = {
  userId: "33333333-3333-4333-8333-333333333333",
  role: "admin",
  status: "active",
  isDemo: false,
  providerType: "email",
  providerUid: "uid-admin",
  name: null,
} as SessionUser;
const OTHER_USER = "11111111-1111-4111-8111-111111111111";

const PURPOSES: StoragePurposeMap = {
  "sample.main_image": {
    visibility: "public",
    maxBytes: 10,
    contentTypes: ["image/*"],
    upload: { allow: "authenticated" },
  },
  "sample.ownerOnly": {
    visibility: "private",
    maxBytes: 10,
    contentTypes: ["image/*"],
    upload: { allow: "authenticated" },
    // 本人だけ読める（admin でも他人のものは読めない）
    read: { allow: "authenticated", check: ({ actor, object }) => object.ownerUserId === actor?.userId },
  },
};

const PUBLIC_BASE = "https://pub.example/base";
let savedBase: string | undefined;
before(() => {
  savedBase = process.env.NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL;
  process.env.NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL = PUBLIC_BASE;
});
after(() => {
  if (savedBase === undefined) delete process.env.NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL;
  else process.env.NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL = savedBase;
});

function setup() {
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
  return { ledger, fake, service, media: createDataMigrationMediaResolver(admin, service) };
}

const ledgerIdOf = (ref: string) => ref.split("/").at(-1)!.split(".")[0];

describe("dataMigration の media resolver", () => {
  test("putAsset と copy は実行者を所有者にして新しい ref を作る（元のファイルは変えない）", async () => {
    const { ledger, fake, media } = setup();
    const ref = await media.putAsset({ purpose: "sample.main_image", body: new Uint8Array([1, 2]), contentType: "image/png", scopeId: null });
    assert.equal((await ledger.findById(ledgerIdOf(ref)))?.ownerUserId, admin.userId);

    const copied = await media.copy({ source: ref, purpose: "sample.main_image", scopeId: null });
    assert.notEqual(copied, ref);
    const row = await ledger.findById(ledgerIdOf(copied));
    assert.equal(row?.ownerUserId, admin.userId);
    assert.equal(row?.status, "ready");
    assert.equal((await ledger.findById(ledgerIdOf(ref)))?.status, "ready", "複製元はそのまま");
    assert.equal(fake.objects.size, 2);
  });

  test("export: pub は公開 URL、priv は実行者で read を判定し、許可されたものだけ署名 URL", async () => {
    const { service, media } = setup();
    const pub = await media.putAsset({ purpose: "sample.main_image", body: new Uint8Array([1]), contentType: "image/png", scopeId: null });
    assert.equal(await media.resolveExportUrl(pub), `${PUBLIC_BASE}/sample.main_image/${ledgerIdOf(pub)}.png`);

    const mine = await media.putAsset({ purpose: "sample.ownerOnly", body: new Uint8Array([1]), contentType: "image/png", scopeId: null });
    const minesUrl = await media.resolveExportUrl(mine);
    assert.ok(minesUrl?.startsWith("fake-storage://read/"), "読める priv は署名 URL");

    const others = await service.putFromServer({
      purpose: "sample.ownerOnly",
      body: new Uint8Array([1]),
      contentType: "image/png",
      ownerUserId: OTHER_USER,
    });
    assert.equal(await media.resolveExportUrl(others.ref), null, "admin でも read 規則が許さないものは null");
    assert.equal(await media.resolveExportUrl("storage://priv/sample.ownerOnly/broken"), null);
  });
});
