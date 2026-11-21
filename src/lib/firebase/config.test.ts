// src/lib/firebase/config.test.ts
// 上書き(@lib-config/firebase)の値が client の SDK の設定と Admin の値に届くこと・未設定の判定が今と同じことのテスト(Firebase 不要)。
// 実行: pnpm test src/lib/firebase(node:test。SDK は初期化しない: 純粋な関数 client/options・server/options に compose の結果を渡す)
import { test } from "node:test";
import assert from "node:assert/strict";

import { firebaseConfigDef } from "./config";
import { firebaseClientOptions, isClientConfigComplete } from "./client/options";
import { firebaseAdminOptions, readServiceAccountKey } from "./server/options";

const PUBLIC = {
  apiKey: "key",
  authDomain: "demo.firebaseapp.com",
  projectId: "demo",
  storageBucket: "demo.appspot.com",
  messagingSenderId: "123",
  appId: "1:123:web:abc",
  measurementId: "G-TEST",
};

// 上流の既定は compose({}) で見る(読み込んだ firebaseConfig は src/config/lib/firebase.config.ts と env で変わる)
test("空の上書きでは client も server も未設定(今と同じ)", () => {
  const config = firebaseConfigDef.compose({});
  assert.equal(isClientConfigComplete(config), false);
  assert.equal(readServiceAccountKey(config), "");
  assert.deepEqual(firebaseAdminOptions(config), {});
  assert.equal(firebaseClientOptions(config).measurementId, undefined, "空の測定 ID は渡さない");
});

test("env が無い(undefined)キーは既定の空のまま = 未設定", () => {
  const config = firebaseConfigDef.compose({ apiKey: undefined, projectId: undefined, serviceAccountKey: () => undefined });
  assert.equal(isClientConfigComplete(config), false);
  assert.equal(readServiceAccountKey(config), "");
});

test("空白だけの apiKey / projectId は未設定(trim)", () => {
  assert.equal(isClientConfigComplete(firebaseConfigDef.compose({ apiKey: " ", projectId: "demo" })), false);
  assert.equal(isClientConfigComplete(firebaseConfigDef.compose({ apiKey: "key", projectId: "  " })), false);
});

test("上書きの公開の値が client の SDK の設定に届く", () => {
  const config = firebaseConfigDef.compose(PUBLIC);
  assert.equal(isClientConfigComplete(config), true);
  assert.deepEqual(firebaseClientOptions(config), PUBLIC);
});

test("上書きの projectId / storageBucket が Admin の値に届き、空の値は渡さない", () => {
  assert.deepEqual(firebaseAdminOptions(firebaseConfigDef.compose(PUBLIC)), {
    projectId: "demo",
    storageBucket: "demo.appspot.com",
  });
  assert.deepEqual(firebaseAdminOptions(firebaseConfigDef.compose({ projectId: "demo" })), { projectId: "demo" });
});

test("鍵の関数は compose では呼ばれず、Admin の側が読む時に毎回呼ばれる", () => {
  let calls = 0;
  const config = firebaseConfigDef.compose({
    serviceAccountKey: () => {
      calls += 1;
      return '  {"type":"service_account"}\n';
    },
  });
  assert.equal(calls, 0, "合成では呼ばない");
  assert.equal(readServiceAccountKey(config), '{"type":"service_account"}');
  assert.equal(readServiceAccountKey(config), '{"type":"service_account"}');
  assert.equal(calls, 2, "読むたびに呼ぶ");
});
