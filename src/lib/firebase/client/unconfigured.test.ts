// src/lib/firebase/client/unconfigured.test.ts
//
// クライアント側 Firebase が未設定（NEXT_PUBLIC_FIREBASE_* が空）のときの契約の検査（Firebase 不要）。
// import だけでは落ちず、`auth` / `fstore` に触れた時点で FirebaseNotConfiguredError("client") を投げる。
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, test } from "node:test";
import assert from "node:assert/strict";

import { FirebaseNotConfiguredError } from "../errors";

process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "";

let client: typeof import("./app");
before(async () => {
  client = await import("./app");
});

function assertNotConfigured(run: () => unknown) {
  assert.throws(run, (error: unknown) => {
    assert.ok(error instanceof FirebaseNotConfiguredError);
    assert.equal(error.side, "client");
    return true;
  });
}

test("未設定なら import は落ちず、isFirebaseClientConfigured は false", () => {
  assert.equal(client.isFirebaseClientConfigured(), false);
});

test("未設定の fstore は触れた時点で FirebaseNotConfiguredError(client) を投げる", async () => {
  assertNotConfigured(() => (client.fstore as unknown as { type: unknown }).type);
  // SDK 関数に渡しても接続を待たずに同じエラーで止まる
  const { collection } = await import("firebase/firestore");
  assertNotConfigured(() => collection(client.fstore, "chat_rooms"));
});

test("未設定の auth は触れた時点で FirebaseNotConfiguredError(client) を投げる", () => {
  assertNotConfigured(() => client.auth.currentUser);
});

test("then とシンボルのキーは素通しする（await やログ出力で落ちない）", () => {
  assert.equal((client.fstore as unknown as { then: unknown }).then, undefined);
  assert.equal((client.fstore as unknown as Record<symbol, unknown>)[Symbol.toStringTag], undefined);
});
