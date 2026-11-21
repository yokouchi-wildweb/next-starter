// src/lib/storage/config.test.ts
// 上書き(@lib-config/storage)の保存先と公開 base の関数が、使うたびに呼ばれて保存先の解決と表示用 URL に届くことのテスト(GCS 不要)。
// 設定を偽物に差し替え(関数の返す値をテストの途中で変える)、server/stores.ts と ref.ts を読む。
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";

/** 関数の返す値。テストの途中で書き換え、次の呼び出しで見えることを確かめる */
const env: Record<string, string | undefined> = {};
const calls: string[] = [];
const fromEnv = (name: string) => () => {
  calls.push(name);
  return env[name];
};

mock.module("./config", {
  namedExports: {
    storageConfig: {
      publicBaseUrl: fromEnv("base"),
      stores: {
        pub: { bucket: fromEnv("pubBucket"), prefix: fromEnv("pubPrefix") },
        priv: { bucket: fromEnv("privBucket"), prefix: fromEnv("privPrefix") },
        legacy: { bucket: fromEnv("legacyBucket") },
      },
    },
  },
});

let stores: typeof import("./server/stores");
let ref: typeof import("./ref");
before(async () => {
  stores = await import("./server/stores");
  ref = await import("./ref");
});

beforeEach(() => {
  for (const key of Object.keys(env)) delete env[key];
});

test("読み込みでは関数を呼ばない", () => {
  assert.deepEqual(calls, []);
});

test("バケットが空なら未設定(誤りの文は今と同じ env の名前)", () => {
  assert.equal(stores.isStorageStoreConfigured("priv"), false);
  assert.throws(
    () => stores.getStoreConfig("priv"),
    (error: unknown) =>
      error instanceof stores.StorageNotConfiguredError &&
      error.store === "priv" &&
      error.missing.join() === "STORAGE_PRIVATE_BUCKET",
  );
  env.legacyBucket = "  ";
  assert.equal(stores.isStorageStoreConfigured("legacy"), false, "空白だけは空");
});

test("上書きの値が保存先の解決に届き、値を変えると次の呼び出しで変わる", () => {
  env.pubBucket = "pub-a";
  env.pubPrefix = "/app";
  assert.deepEqual(stores.getStoreConfig("pub"), { bucket: "pub-a", prefix: "app/" });
  assert.deepEqual(stores.locationOf("pub", "x/1.png"), { bucket: "pub-a", path: "app/x/1.png" });

  env.pubBucket = "pub-b";
  delete env.pubPrefix;
  assert.equal(stores.isStorageStoreConfigured("pub"), true);
  assert.deepEqual(stores.locationOf("pub", "x/1.png"), { bucket: "pub-b", path: "x/1.png" });

  env.legacyBucket = "old.appspot.com";
  assert.deepEqual(stores.getStoreConfig("legacy"), { bucket: "old.appspot.com", prefix: "" });
});

test("公開 base は表示用 URL を作るたびに読む(options.publicBaseUrl があればそちら)", () => {
  const value = "storage://pub/user.avatar/01920000-0000-7000-8000-000000000001.png";
  assert.equal(ref.resolveStorageSrc(value), null, "未設定なら null");
  env.base = "https://cdn.example.test/app/";
  assert.equal(ref.resolveStorageSrc(value), "https://cdn.example.test/app/user.avatar/01920000-0000-7000-8000-000000000001.png");
  env.base = "https://cdn2.example.test";
  assert.equal(ref.publicStorageBaseUrl(), "https://cdn2.example.test");
  assert.deepEqual(ref.publicStorageHosts(), ["cdn2.example.test"]);
  assert.equal(ref.publicStorageBaseUrl({ publicBaseUrl: "https://given.test/" }), "https://given.test");
});
